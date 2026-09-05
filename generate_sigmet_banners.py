#!/usr/bin/env python3
"""
generate_sigmet_banners.py

Robust pipeline to process SIGMET data from IWXXM bulletins, fixing legacy flaws:
1. Fixes grouping by WMO bulletin timestamp and station rather than arbitrary string slicing.
2. Robustly parses IWXXM XML even with trailing GTS/socket ETX bytes (\x03).
3. Extracts TAC alphanumeric messages directly from the IWXXM XML comments.
4. Generates XML banner interface files: Sigmetdata_YYYYMMDD_HHMM.xml side-by-side in the date subfolder.
5. Indexes and links all cancellations with their original SIGMETs.
6. Generates a comprehensive JSON feed for the sigmet-poc web application.
"""

import os
import re
import glob
import json
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Any, Optional

def map_sigmet_num(sigmet_num: str) -> int:
    """Map SIGMET sequence number (e.g. A01 -> 1, B01 -> 51) following legacy logic."""
    prefix = sigmet_num[0].upper()
    digits = int(re.search(r'\d+', sigmet_num[1:]).group())
    if prefix == 'A':
        return digits
    elif prefix == 'B':
        return digits + 50
    return digits

def parse_direction_deg_to_text(deg_val: Optional[float]) -> str:
    """Map numeric degrees to compass heading text."""
    if deg_val is None:
        return "STNR"
    compass_sectors = [
        ("N", 0.0), ("NNE", 22.5), ("NE", 45.0), ("ENE", 67.5),
        ("E", 90.0), ("ESE", 112.5), ("SE", 135.0), ("SSE", 157.5),
        ("S", 180.0), ("SSW", 202.5), ("SW", 225.0), ("WSW", 247.5),
        ("W", 270.0), ("WNW", 292.5), ("NW", 315.0), ("NNW", 337.5)
    ]
    # Normalize degree
    deg = (deg_val % 360.0)
    closest_dir = "N"
    min_diff = 360.0
    for direction, target in compass_sectors:
        diff = abs((deg - target + 180.0) % 360.0 - 180.0)
        if diff < min_diff:
            min_diff = diff
            closest_dir = direction
    return closest_dir

def parse_iwxxm_file(file_path: str) -> Dict[str, Any]:
    """Parse an LSSR (IWXXM) bulletin file, handling WMO headers and ETX trailer bytes."""
    with open(file_path, "rb") as fp:
        raw_bytes = fp.read()
    
    # 1. Extract embedded TAC message from XML comment
    text_content = raw_bytes.decode("utf-8", errors="ignore")
    comment_match = re.search(r"<!--(.*?)-->", text_content, re.DOTALL)
    tac_message = comment_match.group(1).strip() if comment_match else ""
    # Clean trailing '='
    tac_clean = tac_message.rstrip("= ").strip()

    # 2. Extract valid XML block between <?xml and </collect:MeteorologicalBulletin>
    xml_start = raw_bytes.find(b"<?xml")
    if xml_start == -1:
        raise ValueError(f"No <?xml declaration found in {file_path}")
    
    end_tag = b"</collect:MeteorologicalBulletin>"
    xml_end = raw_bytes.rfind(end_tag)
    if xml_end == -1:
        raise ValueError(f"Closing tag {end_tag.decode()} not found in {file_path}")
    
    xml_bytes = raw_bytes[xml_start:xml_end + len(end_tag)]
    root = ET.fromstring(xml_bytes)

    # 3. Namespaces
    ns = {
        "collect": "http://def.wmo.int/collect/2014",
        "iwxxm": "http://icao.int/iwxxm/2023-1",
        "gml": "http://www.opengis.net/gml/3.2",
        "aixm": "http://www.aixm.aero/schema/5.1.1",
        "xlink": "http://www.w3.org/1999/xlink"
    }

    sigmet_el = root.find(".//iwxxm:SIGMET", ns)
    if sigmet_el is None:
        raise ValueError(f"No iwxxm:SIGMET element found in {file_path}")

    is_cancel = sigmet_el.attrib.get("isCancelReport") == "true" or "CNL" in tac_clean

    # Issue Time
    issue_time_el = root.find(".//iwxxm:issueTime//gml:timePosition", ns)
    issue_time_str = issue_time_el.text.strip() if issue_time_el is not None else ""
    issue_dt = datetime.strptime(issue_time_str, "%Y-%m-%dT%H:%M:%SZ")

    # FIR
    fir_el = root.find(".//iwxxm:issuingAirTrafficServicesRegion//aixm:designator", ns)
    fir_code = fir_el.text.strip() if fir_el is not None else ""
    fir_name_el = root.find(".//iwxxm:issuingAirTrafficServicesRegion//aixm:name", ns)
    fir_name = fir_name_el.text.strip() if fir_name_el is not None else fir_code

    # Sequence Number
    seq_el = root.find(".//iwxxm:sequenceNumber", ns)
    seq_num = seq_el.text.strip() if seq_el is not None else ""

    # Validity Period
    begin_el = root.find(".//iwxxm:validPeriod//gml:beginPosition", ns)
    end_el = root.find(".//iwxxm:validPeriod//gml:endPosition", ns)
    valid_start_iso = begin_el.text.strip() if begin_el is not None else ""
    valid_end_iso = end_el.text.strip() if end_el is not None else ""

    valid_start_dt = datetime.strptime(valid_start_iso, "%Y-%m-%dT%H:%M:%SZ")
    valid_end_dt = datetime.strptime(valid_end_iso, "%Y-%m-%dT%H:%M:%SZ")

    # Cancelled report details if applicable
    cnl_seq = None
    cnl_start_iso = None
    cnl_end_iso = None
    if is_cancel:
        cnl_seq_el = root.find(".//iwxxm:cancelledReportSequenceNumber", ns)
        if cnl_seq_el is not None:
            cnl_seq = cnl_seq_el.text.strip()
        cnl_begin_el = root.find(".//iwxxm:cancelledReportValidPeriod//gml:beginPosition", ns)
        if cnl_begin_el is not None:
            cnl_start_iso = cnl_begin_el.text.strip()
        cnl_end_el = root.find(".//iwxxm:cancelledReportValidPeriod//gml:endPosition", ns)
        if cnl_end_el is not None:
            cnl_end_iso = cnl_end_el.text.strip()
        
        # Fallback from TAC if needed
        if not cnl_seq:
            m_cnl = re.search(r"CNL\s+SIGMET\s+([A-Z0-9]+)\s+(\d{6})/(\d{6})", tac_clean)
            if m_cnl:
                cnl_seq = m_cnl.group(1)

    # Phenomenon
    phen_el = root.find(".//iwxxm:phenomenon", ns)
    phenomenon_code = ""
    phenomenon_name = ""
    if phen_el is not None:
        href = phen_el.attrib.get(f"{{{ns['xlink']}}}href", "")
        phenomenon_code = href.split("/")[-1] if "/" in href else href
        phenomenon_name = phen_el.attrib.get(f"{{{ns['xlink']}}}title", phenomenon_code)

    # Geometry, Flight Level, Motion, and Intensity
    geometry_coords: List[List[float]] = [] # [ [lon, lat], ... ]
    upper_fl: Optional[str] = None
    lower_fl: Optional[str] = None
    motion_dir_deg: Optional[float] = None
    motion_dir_text: Optional[str] = None
    motion_speed_kt: Optional[int] = None
    intensity_change: Optional[str] = None

    pos_list_el = root.find(".//gml:posList", ns)
    if pos_list_el is not None and pos_list_el.text:
        coords_raw = [float(x) for x in pos_list_el.text.strip().split()]
        # Pairs: lat, lon -> convert to GeoJSON lon, lat
        for i in range(0, len(coords_raw), 2):
            lat = coords_raw[i]
            lon = coords_raw[i+1]
            geometry_coords.append([lon, lat])

    # Flight Level
    upper_el = root.find(".//aixm:AirspaceVolume//aixm:upperLimit", ns)
    if upper_el is not None:
        upper_fl = f"FL{upper_el.text.strip()}"
    lower_el = root.find(".//aixm:AirspaceVolume//aixm:lowerLimit", ns)
    if lower_el is not None:
        lower_fl = f"FL{lower_el.text.strip()}"
    
    # Check TAC for top flight level (e.g. TOP FL540)
    tac_fl_match = re.search(r"(TOP\s+FL\d+|FL\d+/\d+|SFC/FL\d+)", tac_clean)
    flight_level_display = tac_fl_match.group(1) if tac_fl_match else (upper_fl or "")

    # Motion
    dir_el = root.find(".//iwxxm:directionOfMotion", ns)
    if dir_el is not None and dir_el.text:
        try:
            motion_dir_deg = float(dir_el.text.strip())
            motion_dir_text = parse_direction_deg_to_text(motion_dir_deg)
        except ValueError:
            pass
    
    spd_el = root.find(".//iwxxm:speedOfMotion", ns)
    if spd_el is not None and spd_el.text:
        try:
            motion_speed_kt = int(float(spd_el.text.strip()))
        except ValueError:
            pass

    # Intensity Change
    evolving_el = root.find(".//iwxxm:SIGMETEvolvingCondition", ns)
    if evolving_el is not None:
        intensity_change = evolving_el.attrib.get("intensityChange")

    # If stationary in TAC
    if "STNR" in tac_clean:
        motion_dir_text = "STNR"
        motion_speed_kt = 0

    return {
        "filePath": file_path,
        "fileName": os.path.basename(file_path),
        "issueTime": issue_time_str,
        "issueDt": issue_dt,
        "firCode": fir_code,
        "firName": fir_name,
        "sequenceNumber": seq_num,
        "validStart": valid_start_iso,
        "validEnd": valid_end_iso,
        "validStartDt": valid_start_dt,
        "validEndDt": valid_end_dt,
        "isCancel": is_cancel,
        "cancelledSeq": cnl_seq,
        "cancelledValidStart": cnl_start_iso,
        "cancelledValidEnd": cnl_end_iso,
        "phenomenonCode": phenomenon_code,
        "phenomenonName": phenomenon_name,
        "flightLevel": flight_level_display,
        "motionDirectionDeg": motion_dir_deg,
        "motionDirectionText": motion_dir_text,
        "motionSpeedKt": motion_speed_kt,
        "intensityChange": intensity_change,
        "geometry": {
            "type": "Polygon",
            "coordinates": [geometry_coords] if geometry_coords else []
        },
        "rawTac": tac_clean
    }

def generate_banner_xml(sigmet_data: Dict[str, Any], output_path: str):
    """Write the legacy banner XML interface file."""
    channel = ET.Element("channel")
    title_el = ET.SubElement(channel, "title")
    title_el.text = "Singapore SIGMET"
    source_el = ET.SubElement(channel, "source")
    source_el.text = "Meteorological Service Singapore"

    item = ET.SubElement(channel, "item")
    issue_dt: datetime = sigmet_data["issueDt"]
    
    year = ET.SubElement(item, "Year")
    year.text = issue_dt.strftime("%Y")

    month = ET.SubElement(item, "Month")
    month.text = issue_dt.strftime("%m")

    day = ET.SubElement(item, "Day")
    day.text = issue_dt.strftime("%d")

    issue_hhmm = issue_dt.strftime("%H%M")
    sigmet_issue = ET.SubElement(item, "SIGMETIssue")
    sigmet_issue.text = issue_hhmm

    # First two letters of TAC message (e.g. WS)
    tac_words = sigmet_data["rawTac"].split()
    type_str = tac_words[0][:2] if tac_words else "WS"
    type_el = ET.SubElement(item, "Type")
    type_el.text = type_str

    sigmet_no = ET.SubElement(item, "SIGMET_NO")
    sigmet_no.text = sigmet_data["sequenceNumber"]

    image_name = ET.SubElement(item, "IMAGE_NAME")
    mapped_no = map_sigmet_num(sigmet_data["sequenceNumber"])
    date_str = issue_dt.strftime("%Y%m%d")
    image_name.text = f"sigmet_{type_str.lower()}_{mapped_no}_{date_str}_{issue_hhmm}.png"

    valid_start_dt: datetime = sigmet_data["validStartDt"]
    valid_end_dt: datetime = sigmet_data["validEndDt"]
    valid_start = ET.SubElement(item, "VALID_START")
    valid_start.text = valid_start_dt.strftime("%H%M")

    valid_end = ET.SubElement(item, "VALID_END")
    valid_end.text = valid_end_dt.strftime("%H%M")

    cnl = ET.SubElement(item, "CNL")
    cnl.text = "Yes" if sigmet_data["isCancel"] else "No"

    sigmet_text = ET.SubElement(item, "SIGMET")
    sigmet_text.text = sigmet_data["rawTac"]

    # Format XML nicely
    ET.indent(channel, space="    ")
    tree = ET.ElementTree(channel)
    tree.write(output_path, encoding="utf-8", xml_declaration=True)

def main():
    base_data_dir = "data/aviation_sigmet/2026/05"
    day_dirs = sorted([d for d in glob.glob(os.path.join(base_data_dir, "*")) if os.path.isdir(d)])

    print(f"Found {len(day_dirs)} day directories in {base_data_dir}")

    all_sigmets: List[Dict[str, Any]] = []
    generated_xml_count = 0

    # 1. Parse all IWXXM bulletins across all days
    for day_dir in day_dirs:
        lssr_files = sorted(glob.glob(os.path.join(day_dir, "LSSR*")))
        for lssr_file in lssr_files:
            try:
                sig_info = parse_iwxxm_file(lssr_file)
                all_sigmets.append(sig_info)

                # Generate XML side-by-side in the same subfolder
                issue_dt: datetime = sig_info["issueDt"]
                xml_filename = f"Sigmetdata_{issue_dt.strftime('%Y%m%d')}_{issue_dt.strftime('%H%M')}.xml"
                xml_path = os.path.join(day_dir, xml_filename)
                generate_banner_xml(sig_info, xml_path)
                generated_xml_count += 1
            except Exception as e:
                print(f"Error processing {lssr_file}: {e}")

    print(f"Total SIGMET bulletins parsed: {len(all_sigmets)}")
    print(f"Total banner XML files generated: {generated_xml_count}")

    # 2. Link Cancellations to original SIGMETs
    active_by_key = {}
    for sig in all_sigmets:
        if not sig["isCancel"]:
            key = (sig["firCode"], sig["sequenceNumber"], sig["validStart"], sig["validEnd"])
            active_by_key[key] = sig

    matched_cancellations = 0
    for sig in all_sigmets:
        if sig["isCancel"]:
            key = (sig["firCode"], sig["cancelledSeq"], sig["cancelledValidStart"], sig["cancelledValidEnd"])
            target = active_by_key.get(key)
            if target:
                sig["cancelledSigmetRef"] = {
                    "sequenceNumber": target["sequenceNumber"],
                    "validStart": target["validStart"],
                    "validEnd": target["validEnd"],
                    "phenomenonName": target["phenomenonName"],
                    "flightLevel": target["flightLevel"],
                    "rawTac": target["rawTac"],
                    "geometry": target["geometry"]
                }
                # Also attach cancellation info to the target active SIGMET so UI knows it was cancelled at issueTime
                target["cancellationInfo"] = {
                    "cancelledAt": sig["issueTime"],
                    "cancellationSeq": sig["sequenceNumber"],
                    "cancellationTac": sig["rawTac"]
                }
                matched_cancellations += 1
            else:
                print(f"Warning: Cancellation {sig['fileName']} did not match any active SIGMET for key {key}")

    print(f"Matched cancellations: {matched_cancellations} / {sum(1 for s in all_sigmets if s['isCancel'])}")

    # 3. Export structured JSON for sigmet-poc web application
    poc_data_dir = "sigmet-poc/src/data"
    os.makedirs(poc_data_dir, exist_ok=True)
    json_path = os.path.join(poc_data_dir, "sigmet_dataset.json")

    # Serialize datetime objects to ISO strings
    json_export = []
    for sig in all_sigmets:
        sig_copy = dict(sig)
        del sig_copy["issueDt"]
        del sig_copy["validStartDt"]
        del sig_copy["validEndDt"]
        json_export.append(sig_copy)

    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(json_export, jf, indent=2)

    print(f"Exported JSON dataset to {json_path} ({len(json_export)} records)")

if __name__ == "__main__":
    main()
