import xml.etree.ElementTree as ET
import geopandas as gpd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
from shapely.geometry import Polygon
import os
from datetime import datetime
import argparse
import logging
import sys
import logging.config
from logging.handlers import RotatingFileHandler
import cartopy.crs as ccrs
import cartopy.feature as cfeature
import re
import os
import time


#Added feature: Weather phenonmenon is now read from IWXXM and FL is not added, it will skip in the box.

input_directory = '/ess/data/script/sigmet/input'
#Coastline
coastline_path = '/ess/data/script/sigmet/ASEAN_shp_updated/ASEAN_shp_updated/ASEAN_shp.shp'
#New FIR
fir_shapefile = '/ess/data/script/sigmet/merged_FIR/merged_FIR.shp'

#input_directory = '/mnt/c/Users/LZL/Downloads/sigmet_resolve/input'
#coastline_path = '/mnt/c/Users/LZL/Desktop/Ocean/ASEAN_shp_updated/ASEAN_shp_updated/ASEAN_shp.shp'
#fir_shapefile = '/mnt/c/Users/LZL/Downloads/sigmet_resolve/merged_FIR/merged_FIR.shp'


output_image_directory = "/ess/data/script/sigmet/output"
output_image_directory2 = "/ess/data/script/sigmet/archive"
config_dir = "/ess/data/script/sigmet/config"
log_dir = "/ess/data/script/sigmet/log"
archive_check = "/ess/data/script/sigmet/archive_check"

#output_image_directory = "/mnt/c/Users/LZL/Downloads/sigmet_resolve/output1"
#output_image_directory2 = "/mnt/c/Users/LZL/Downloads/sigmet_resolve/output2"
#config_dir = "/mnt/c/Users/LZL/Downloads"
#log_dir = "/mnt/c/Users/LZL/Downloads/sigmet_resolve/log"
#archive_check = "/mnt/c/Users/LZL/Downloads/sigmet_resolve/output3"

# Keep log file to a max size of 1 MB and a max of 1 backup file
LOG_MAX_BYTES = 1024 * 1024
LOG_MAX_BACKUP = 1
# Import logging configuration file
logging.config.fileConfig(fname=os.path.join(
    config_dir, 'log.config'), disable_existing_loggers=False)
# Get the logger specified in the file
f_handler = RotatingFileHandler(os.path.join(log_dir, 'Sigmet.log'),
                                maxBytes=LOG_MAX_BYTES,
                                backupCount=LOG_MAX_BACKUP)
f_handler.setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)
f_format = logging.Formatter('%(asctime)s - \
%(name)s - %(levelname)s - %(message)s')
f_handler.setFormatter(f_format)
logger.addHandler(f_handler)

def map_sigmet_num(sigmet_num):
    if sigmet_num[0] == "A" or sigmet_num[0] == "a":
        return int(sigmet_num[1:])
    elif sigmet_num[0] == "B" or sigmet_num[0] == "b":
        return int(sigmet_num[1:]) + 50

def load_and_filter_shapefile(shapefile_path, min_lat, max_lat, min_lon, max_lon):
    # Load the filtered shapefile based on specified latitude and longitude ranges
    filtered_asean_coast = gpd.read_file(shapefile_path, bbox=(min_lon, min_lat, max_lon, max_lat))
    

    return filtered_asean_coast

def plot_filtered_shapefile(ax, filtered_shapefile):
    # Plot the filtered shapefile on the map
    filtered_shapefile_combined = filtered_shapefile.dissolve(by = ['NAME_0'])
    filtered_shapefile_combined.boundary.plot(ax=ax, color='lightgrey', edgecolor='black')


matching_files_dict = {}
# Iterate over the files in the directory
for filename in os.listdir(input_directory):
    # Splitting the string by underscores and taking the second part
    #file_name = filename # Splitting the string by underscores and taking the second part
    desired_string = filename[16:23]   # Removing the file extension if present
    print("Desired string:", desired_string)
    if desired_string not in matching_files_dict:
        matching_files_dict[desired_string] = []
    matching_files_dict[desired_string].append(filename)
# Sort the matching files for each desired string
for desired_string, files in matching_files_dict.items():
    files.sort(key=lambda x: ('L' in x, 'W' in x, x)) 
    
    #sort files based on modification time
    files.sort(key=lambda x: os.path.getmtime(os.path.join(input_directory, x)))

print(matching_files_dict)
for desired_string, files in matching_files_dict.items():
    file_path1 = os.path.join(input_directory, files[1])
    # Read IWXXM input from a text file
    with open(file_path1, 'r') as file:
        iwxxm_input = file.read()

    #print(iwxxm_input)
    # Find the index where the XML declaration starts
    iwxxm_declaration_start = iwxxm_input.find('<?xml')

    # Extract the XML content excluding the header
    iwxxm_content = iwxxm_input[iwxxm_declaration_start:]

    
    # Parse IWXXM XML
    try:
        # Parse IWXXM XML
        iwxxm_root = ET.fromstring(iwxxm_content)
    except ET.ParseError as e:
        print("Error parsing IWXXM XML:", e)

    # Extract FIR coordinates
    fir_coordinates = []
    # Find all <gml:posList> elements within the IWXXM XML
    pos_lists = iwxxm_root.findall('.//{http://www.opengis.net/gml/3.2}posList')

    # Check if any <gml:posList> elements are found
    if pos_lists:
        for pos_list in pos_lists:
            # Extract the text content of the <gml:posList> element
            pos_list_text = pos_list.text
            
            # Check if the text content is not empty
            if pos_list_text:
                # Split the text content into individual coordinate pairs
                coordinates_text = pos_list_text.split()
                
                # Check if the number of coordinates is even (each coordinate pair has latitude and longitude)
                if len(coordinates_text) % 2 == 0:
                    # Convert the text coordinates to floating-point numbers and store them as tuples in the fir_coordinates list
                    coordinates = [(float(coordinates_text[i]), float(coordinates_text[i+1])) for i in range(0, len(coordinates_text), 2)]
                    fir_coordinates.append(coordinates)
                else:
                    print("Invalid number of coordinates in posList:", pos_list_text)
            else:
                print("posList is empty.")
                logging.warning("posList is empty in IWXXM XML.")
    else:
        print("No posList found in IWXXM XML.")
        logging.warning("No posList elements found in IWXXM XML.")

    print("FIR Coordinates:", fir_coordinates)


    file_path2 = os.path.join(input_directory, files[0])
    # Read TAC input from file
    
    with open(file_path2, 'r') as file:
        tac_input = file.read()

    # Parse TAC input, skipping empty lines
    tac_lines = [line.strip() for line in tac_input.split('\n') if line.strip()]

    

    

    # Concatenate TAC lines with phenomenon and movements (if available) to include in the title
    title2 = ''
    for idx, line in enumerate(tac_lines):
        title2 += f"{line} "
    
    print(title2)

    title = ''
    for idx, line in enumerate(tac_lines):
        title += f"\n{line} "
    time_position = iwxxm_root.find('.//{http://www.opengis.net/gml/3.2}timePosition')
    if time_position is None:
        logging.info("time_position not found in IWXXM") 

    # Check if the <gml:timePosition> element is found
    if time_position is not None:
        # Extract the datetime string
        datetime_str = time_position.text
    
    # Parse the datetime string into a datetime object
        datetime_obj = datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%SZ')

        print("Parsed Datetime:", datetime_obj)
    else:
        print("timePosition element not found in IWXXM XML.")    

    # Create the root element
    channel = ET.Element("channel")

    # Create sub-elements
    titlel = ET.SubElement(channel, "title")
    titlel.text = "Singapore SIGMET"

    source = ET.SubElement(channel, "source")
    source.text = "Meteorological Service Singapore"

    item = ET.SubElement(channel, "item")
    
    date_str = datetime_obj.strftime('%Y%m%d')
    year = ET.SubElement(item, "Year")
    year.text = date_str[:4]

    month = ET.SubElement(item, "Month")
    month.text =  date_str[4:6]

    day = ET.SubElement(item, "Day")
    day.text =  date_str[6:8]

    SIGMETIssue = ET.SubElement(item, "SIGMETIssue")
    SIGMETIssue.text = desired_string[0:4]

    first_two_letters = title2.split()[0][:2]
    Type = ET.SubElement(item, "Type")
    Type.text = str(first_two_letters)

    sigmet_number_idx = title2.split().index("SIGMET", 0)
    sigmet_number = title2.split()[sigmet_number_idx +1]
    SIGMET_NO = ET.SubElement(item, "SIGMET_NO")
    SIGMET_NO.text = sigmet_number
    first_two_letters2 = str(first_two_letters).lower()


    IMAGE_NAME = ET.SubElement(item, "IMAGE_NAME")
    mapped_sigmet_number = map_sigmet_num(sigmet_number)
    IMAGE_NAME.text = f'sigmet_{first_two_letters2}_{mapped_sigmet_number}_{date_str}_{desired_string}.png'

    time_index = title2.split().index("VALID")
    start_time = title2.split()[time_index + 1][2:6]

    print("VALID_START:", start_time)

    end_time = title2.split()[time_index + 1][-4:]
    print("VALID_END:", end_time)

    VALID_START = ET.SubElement(item, "VALID_START")
    VALID_START.text = start_time

    VALID_END = ET.SubElement(item, "VALID_END")
    VALID_END.text = end_time
    
    

    CNL = ET.SubElement(item, "CNL")
    if "CNL" in title2:
        CNL.text = "Yes"
    else:
        CNL.text = "No"
    
    title2 = ''
    for idx, line in enumerate(tac_lines):
        title2 += f"{line} "
    SIGMET = ET.SubElement(item, "SIGMET")
    SIGMET.text = title2.rstrip("= ")

    # Create an ElementTree object
    tree = ET.ElementTree(channel) 

    output_filename2 = f"Sigmetdata_{date_str}_{desired_string}.xml"
    output_xml1 = os.path.join(output_image_directory, output_filename2)
    tree.write(output_xml1, encoding="utf-8", xml_declaration=True)

    output_xml = os.path.join(output_image_directory2, output_filename2)

    # Write the XML to a file
    tree.write(output_xml, encoding="utf-8", xml_declaration=True)        

    
    # Function to parse XML and check for SIGMET criteria
    def check_sigmetxml_in_file(file_path, sig_num, sig_cnl_time):
        tree = ET.parse(file_path)
        root = tree.getroot()
        for item in root.findall('item'):
            sigmet_text = item.find('SIGMET').text
            if f"SIGMET {sig_num} VALID {sig_cnl_time}" in sigmet_text:
                return True
        return False

    if "CNL" in title2:
        # Extract SIGMET number from the TAC message
        sigmet_number_cnl = next(title2.split()[index + 2] for index, word in enumerate(title2.split()) if word == "CNL")
        #The validity time of the sigmet which you are going to cancel
        cnlled_sig_val = next(title2.split()[index + 3] for index, word in enumerate(title2.split()) if word == "CNL").rstrip("=")
        first_two_letters = title2.split()[0][:2]
        sigmet_number_idx = title2.split().index("SIGMET", 0)
        sigmet_number = title2.split()[sigmet_number_idx +1]
        time_position = iwxxm_root.find('.//{http://www.opengis.net/gml/3.2}timePosition')
        if time_position is None:
            logging.info("time_position not found in IWXXM") 

        # Check if the <gml:timePosition> element is found
        if time_position is not None:
            # Extract the datetime string
            datetime_str = time_position.text
    
            # Parse the datetime string into a datetime object
            datetime_obj = datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%SZ')

            print("Parsed Datetime:", datetime_obj)
        else:
            print("timePosition element not found in IWXXM XML.")
        date_str = datetime_obj.strftime('%Y%m%d')
        
        #print(first_two_letters)
        #print(sigmet_number_cnl)
        # Search for the original image file
        image_files = os.listdir(output_image_directory2)
        # Get a list of XML files in the directory
        xml_files = [os.path.join(output_image_directory2, file) for file in os.listdir(output_image_directory2) if file.endswith('.xml')]
        
        # Sort the files by modification time in descending order
        xml_files.sort(key=os.path.getmtime, reverse=True)
        
        # Select the latest 5 XML files
        latest_xml_files = xml_files[:5]
        
        latest_file = None
        latest_timestamp = 0
        # Check the latest 3 XML files and find the latest one with the specified SIGMET text
        latest_file_with_sigmet = None
        for xml_file in latest_xml_files:
            if check_sigmetxml_in_file(xml_file, sigmet_number_cnl , cnlled_sig_val):
                latest_file_with_sigmet = xml_file
                break

        # Print the filename of the latest XML file with the specified SIGMET text
        if latest_file_with_sigmet:
            print(f"The latest XML file with the specified SIGMET text is: {os.path.basename(latest_file_with_sigmet)}")
            logging.info(f"The latest XML file with the specified SIGMET text is: {os.path.basename(latest_file_with_sigmet)}")
        else:
            print("No XML file contains the specified SIGMET text among the latest 3 files.")
            logging.info("No XML file contains the specified SIGMET text among the latest 3 files.")

        # Function to extract the term between the first two underscores in a filename
        def extract_term_from_filename(filename):
            parts = filename.split('_', 1)
            if len(parts) > 1:
                return parts[1].split('.')[0] 
            return None    
        xml_dateval = extract_term_from_filename(os.path.basename(latest_file_with_sigmet))
        print("xml date:", xml_dateval)
        #print(image_files)
        #original_image_filename = None
        png_files = [f for f in image_files if f.endswith(".png")]
        image_file_paths = [os.path.join(output_image_directory2, f) for f in png_files]
        image_file_paths.sort(key=lambda x: os.path.getmtime(x), reverse=True)
        for filename_path in image_file_paths[:10]:
            
            sigmet_number_cnl2 = map_sigmet_num(sigmet_number_cnl)
            print("sigmet_number_cnl2", sigmet_number_cnl2)
            print(f"Full name: sigmet_{str(first_two_letters).lower()}_{sigmet_number_cnl2}_{xml_dateval}.png")
            filename = os.path.basename(filename_path)
            print("image_files:", filename)
            fullname = f"sigmet_{str(first_two_letters).lower()}_{sigmet_number_cnl2}_{xml_dateval}.png"
            if filename == f"sigmet_{str(first_two_letters).lower()}_{sigmet_number_cnl2}_{xml_dateval}.png":
                print("filename_if", filename)
                logging.info("filename_if %s", filename)
                #break
        
      
                # Load the original image
                original_image_path = os.path.join(output_image_directory2, filename)
                
                latest_file = original_image_path
                break
            elif filename.startswith(f"sigmet_{str(first_two_letters).lower()}_{sigmet_number_cnl2}"):
                #original_image_filename = filename
                        
      
                # Load the original image
                original_image_path = os.path.join(output_image_directory2, filename)
                timestamp = os.path.getmtime(original_image_path)  # Get last modification time
                if timestamp > latest_timestamp:
                    latest_timestamp = timestamp
                    latest_file = original_image_path
                    print("filename_elif", latest_file)
                    logging.info("filename_elif", latest_file)
                    
        if latest_file:  
            print(original_image_path)          
            original_image = plt.imread(original_image_path)
            
            # Create a new figure
            fig, ax = plt.subplots(figsize=(20.875, 20.875), dpi=72, facecolor='none', edgecolor='none')
            #fig = plt.figure(figsize=(20.875, 20.875), dpi=72, facecolor='none', edgecolor='none')
            #ax = fig.add_subplot(1, 1, 1, projection=projection)
                

        
            # Show the original image on the axis
            ax.imshow(original_image)
            # Hide tick labels
            ax.tick_params(axis='both', which='both', bottom=False, top=False, left=False, right=False, labelbottom=False, labelleft=False)

            # Get the dimensions of the original image
            height, width, _ = original_image.shape
        
            # Calculate the center coordinates
            center_x = width / 2
            center_y = height / 2
            text = "CANCELLED"
            #plt.imshow(original_image)  # Show the original image
            ax.text(center_x, center_y, text, ha='center', va='center', fontsize=40, color='black')
        
            
            # Save the modified image
            mapped_sigmet_number = map_sigmet_num(sigmet_number)
            print("cancel sigmet issued:", mapped_sigmet_number)
            output_image_filename = f"sigmet_{str(first_two_letters).lower()}_{mapped_sigmet_number}_{date_str}_{desired_string}.png"
            print("cancel sigmet issued image:", output_image_filename)
            output_image_path1 = os.path.join(output_image_directory, output_image_filename)
            plt.savefig(output_image_path1, bbox_inches='tight', pad_inches=0, transparent=True)
            output_image_path = os.path.join(output_image_directory2, output_image_filename)
            plt.savefig(output_image_path, bbox_inches='tight', pad_inches=0, transparent=True)
                
            output_check = os.path.join(archive_check, output_image_filename)
            plt.title(title, fontsize=20, loc='left')
            plt.savefig(output_check, bbox_inches='tight', pad_inches=0, transparent=False)
        
            print(f"Cancelled SIGMET {sigmet_number} and saved as {output_image_path}")
    else:
        min_lat = -4
        max_lat = 14
        min_lon = 96
        max_lon = 120
        # Define the Cartopy PlateCarree projection
        projection = ccrs.PlateCarree()

        # To produce 1503 pixels x 1503 pixels image for underwater
        fig = plt.figure(figsize=(20.875, 20.875), dpi=72, facecolor='none', edgecolor='none')
        ax = fig.add_subplot(1, 1, 1, projection=projection)
    

        # Set the extent of the plot
        ax.set_extent([min_lon, max_lon, min_lat, max_lat])

        # Add coastline
        #ax.add_feature(cfeature.COASTLINE)
    
        filtered_asean_coast = load_and_filter_shapefile(coastline_path, min_lat, max_lat, min_lon, max_lon)

        # Overlay the filtered Asean regional coastline on the map
        plot_filtered_shapefile(ax=plt.gca(), filtered_shapefile=filtered_asean_coast)


        # Overlay the FIR on the map (transparent alpha=0 with black edgecolor)
        #ax = plt.gca()
        # Set x and y ticks directly on the map
        xticks = np.arange(min_lon, max_lon + 1, 3)
        yticks = np.arange(min_lat, max_lat + 1, 3)

        # Convert negative latitudes to South (S) and label the Equator (EQ)
        ytick_labels = [f"{abs(lat)}S" if lat < 0 else "EQ" if lat == 0 else f"{lat}N" for lat in yticks]

        # Example for converting negative longitudes to West (W)
        xtick_labels = [f"{abs(lon)}W" if lon < 0 else f"{lon}E" for lon in xticks]

        # Set ticks and labels
        ax.set_xticks(xticks)
        ax.set_yticks(yticks)
        ax.set_xticklabels(xtick_labels, fontsize=15, color='blue')
        ax.set_yticklabels(ytick_labels, fontsize=15, color='blue')

        # Hide tick labels
        ax.tick_params(axis='both', which='both', bottom=False, top=False, left=False, right=False, labelbottom=False, labelleft=False)

    

        FIR_plot1 = gpd.read_file(fir_shapefile, bbox=(min_lon, min_lat, max_lon, max_lat))
    
        #For New FIR
        FIR_plot1.plot(ax=plt.gca(), color='black')

        #For Old FIR
        #FIR_plot1.boundary.plot(ax=plt.gca(), color='black')

        #FIR_plot2 = gpd.read_file(fir_shapefile2, bbox=(min_lon, min_lat, max_lon, max_lat))
        #FIR_plot2.plot(ax=plt.gca(), color='black')

        #FIR_plot3 = gpd.read_file(fir_shapefile3, bbox=(min_lon, min_lat, max_lon, max_lat))
        #FIR_plot3.plot(ax=plt.gca(), color='grey', alpha=0.5)

        # Loop through each set of coordinates in fir_coordinates
        for coordinates in fir_coordinates:
            # Convert the current set of coordinates to a Polygon object
            fir_polygon = Polygon(coordinates)
            
            # Extract longitude and latitude for plotting
            fir_lon, fir_lat = zip(*coordinates)
            fir_x = fir_lat
            fir_y = fir_lon
            
            # Plot each FIR polygon
            plt.fill(fir_x, fir_y, color='red', edgecolor='black', alpha=0.5)

        # Extract legend information from the title
        legend1_lines1 = title2.split()[0:2] 
        legend1_lines2 = title2.split()[3:6]
        legend1_lines3 = title2.split()[6:9]
        #top_index = [idx for idx, s in enumerate(title2.split()) if "FL" in s][-1] #title2.split().index("MOV") - 1
        #legend2_lines1 = title2.split()[top_index: top_index + 2]
        fl_indices = [idx for idx, s in enumerate(title2.split()) if "FL" in s]
        if fl_indices:
            top_index = fl_indices[-1]  # Get the index of the last occurrence of "FL"
            legend2_lines1 = title2.split()[top_index: top_index + 1]
            legend2_text = ' '.join(legend2_lines1) + '\n'
        else:
            # Handle the case when "FL" is not found
            print("No 'FL' found in the title")
            legend2_text = '\n'            

        #emb_index = title2.split().index("EMBD")
        #legend2_lines2 = title2.split()[emb_index: emb_index + 2]
        #legend2_lines2 is now read from iwxxm
        phenomenon_element = iwxxm_root.find("{http://icao.int/iwxxm/3.0}phenomenon")
        if phenomenon_element is not None:
            phenomenon_title = phenomenon_element.attrib.get("{http://www.w3.org/1999/xlink}title")
            print("Phenomenon Title:", phenomenon_title)
            legend2_lines2 = phenomenon_title
            legend2_text += ' '.join(legend2_lines2) + '\n'
        else:
            legend2_text += '\n'
 
        legend2_lines3 = title2.split()[-1:]
        legend2_text += ' '.join(legend2_lines3)

        # Legend 1: 
        legend1_text = ' '.join(legend1_lines1) + '\n' + ' '.join(legend1_lines2) + '\n' + ' '.join(legend1_lines3) + '\n' + "Red shaded-SIGMET area"
        legend1_patch = mpatches.Rectangle((0, 0), 1, 1, fc="none", edgecolor='none')
        if "STNR" in title2:
           spd = "STNR"
           direction = "STNR"
        else:
            if "MOV" in title2:
                mov_index = title2.split().index("MOV")
                direction = title2.split()[mov_index + 1]
                spd = title2.split()[mov_index + 2]
            else:
                direction = "STNR"
                spd = " "
            print("direction:", direction)
            print("spd:", spd)

        
        if spd is not None:
            try:
                movement_str = str(int(spd[:-2])) + ' KT'
            except ValueError:
                movement_str = 'STNR'
        else:
            movement_str = 'STNR'

        if spd == " ":
            movement_str = " " 

        # Add legend 1 as a box text in the upper right corner
        ax.add_patch(legend1_patch)
        ax.text(0.78, 0.90, legend1_text, ha='left', va='top', fontsize=15, transform=ax.transAxes, bbox=dict(facecolor='white', edgecolor='black', boxstyle='round,pad=0.5'))

        legend_x = fir_x[-1] + 1.5
        legend_y = fir_y[-1] + 1.5
        legend_x_norm = (legend_x - min_lon) / (max_lon - min_lon)
        legend_y_norm = (legend_y - min_lat) / (max_lat - min_lat)
        # Legend 2: 
        legend2_patch = mpatches.Patch(color='none', label=legend2_text)

        # Add legend 2 to the plot
        # Add legend 2 to the plot at a different position using bbox_to_anchor
        legend2 = ax.legend(handles=[legend2_patch], loc="lower right", fontsize=15, bbox_to_anchor=(legend_x_norm, legend_y_norm), frameon=True, framealpha=0.4)
        for text in legend2.get_texts():
            text.set_alpha(1)



        # Define the length of the arrow
        arrow_length = 1  

        # Calculate the center coordinates of the polygon
        center_x = np.mean(fir_x)
        center_y = np.mean(fir_y)

        direction_text = direction
        # Define the direction map
        direction_map = {
            'N': (0, arrow_length),
            'S': (0, -arrow_length),
            'E': (arrow_length, 0),
            'W': (-arrow_length, 0),
            'NE': (arrow_length, arrow_length),
            'SE': (arrow_length, -arrow_length),
            'SW': (-arrow_length, -arrow_length),
            'NW': (-arrow_length, arrow_length),
            'WNW': (-arrow_length*2, arrow_length),
            'NNW': (-arrow_length*2, arrow_length*2),
            'NNE': (arrow_length*2, arrow_length*2),
            'ENE': (arrow_length*2, arrow_length),
            'ESE': (arrow_length*2, -arrow_length),
            'SSE': (arrow_length, -arrow_length*2),
            'SSW': (-arrow_length, -arrow_length*2),
            'WSW': (-arrow_length*2, -arrow_length),
            'WNW': (-arrow_length*2, arrow_length)
        }

        center_x = center_x - 0.3
        center_y = center_y + 0.2
        # Determine the coordinates of the arrow tip based on the direction
        arrow_tip_adjustment = direction_map.get(direction_text, (0, 0))
        arrow_tip = (center_x + arrow_tip_adjustment[0], center_y + arrow_tip_adjustment[1])

        # Convert movement speed to string without leading zero or print (STNR) if it cannot be converted to an integer
       

    #print(center_x)
    # Draw the arrow
        ax.annotate('', xy=arrow_tip, xytext=(center_x, center_y),
            arrowprops=dict(color='green', arrowstyle='->', mutation_scale=35))
    # Annotate the movement speed above the arrow
        ax.text(center_x - 0.3, center_y + 0.1, movement_str, fontsize=15, ha='center', va='bottom') 


        # Extract the first two letters of the first word after splitting the title
        first_two_letters = title2.split()[0][:2]
        print("First two letters:", first_two_letters)  

        time_position = iwxxm_root.find('.//{http://www.opengis.net/gml/3.2}timePosition')

        # Check if the <gml:timePosition> element is found
        if time_position is not None:
            # Extract the datetime string
            datetime_str = time_position.text
    
            # Parse the datetime string into a datetime object
            datetime_obj = datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%SZ')

            print("Parsed Datetime:", datetime_obj)
        else:
            print("timePosition element not found in IWXXM XML.")
        date_str = datetime_obj.strftime('%Y%m%d')
        first_two_letters2 = str(first_two_letters).lower()

        sigmet_number_idx = title2.split().index("SIGMET", 0)
        sigmet_number = title2.split()[sigmet_number_idx +1]
        print("SIGMET_No:", sigmet_number)
    
        mapped_sigmet_number = map_sigmet_num(sigmet_number)
        output_image_filename2 = f'sigmet_{first_two_letters2}_{mapped_sigmet_number}_{date_str}_{desired_string}.png'
        # Save the plot as sigmet.png with a transparent background
        
        output1 = os.path.join(output_image_directory, output_image_filename2)
        plt.savefig(output1, bbox_inches='tight', pad_inches=0, transparent=True)
        output = os.path.join(output_image_directory2, output_image_filename2)
        
        
        plt.savefig(output, bbox_inches='tight', pad_inches=0, transparent=True)

        output_check = os.path.join(archive_check, output_image_filename2)
        plt.title(title, fontsize=20, loc='left')
        plt.savefig(output_check, bbox_inches='tight', pad_inches=0, transparent=False)


    # Show the plot
    #plt.show()

