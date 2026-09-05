#!/bin/bash

# Variables
username="svc_wipdt_sftp"
remote_server="192.168.16.174"
remote_path="/storage/home/svc_iafprod_sftp/MMSS_MDPS/SIGMET/"
local_path="/ess/data/script/sigmet/"
script_server_path="/path/to/script/server/"
year=$(date -u +%Y)
month=$(date -u +%Y%m)
log_file="/ess/data/script/sigmet/log/transferred_files.log"

# Check if directory exists before creating
if [ ! -d "/ess/data2/general/HPC/forecast_archive/Aviation/SIGMET/${year}/${month}/" ]; then
    mkdir -p /ess/data2/general/HPC/forecast_archive/Aviation/SIGMET/${year}/${month}/
    echo "New directory based on year and month created."
else
    echo "Directory already exists."
fi


# Step 1: Pull all files from the remote server path
#scp -r "${username}@${remote_server}:${remote_path}"*WSSS* "${local_path}input/"
ssh "${username}@${remote_server}" "find ${remote_path} -maxdepth 1 -type f -mmin -10 -name '*WSSS*'" | xargs -I {} scp -r "${username}@${remote_server}":{} "${local_path}input/"

#ssh "${username}@${remote_server}" "find ${remote_path} -maxdepth 1 -type f -mtime -1 -name '*WSSS*'" | xargs -I {} scp -r "${username}@${remote_server}":{} "${local_path}input/"


# Step 2: Run your Python script
/ess/opt/anaconda311/bin/python "${local_path}scripts/SIGMET_fnl3.py" 

# Step 3: Send the output back to the script server
scp -r "${local_path}output/"* svc_wipdt_sftp@192.168.16.174:/storage/home/svc_wipdt_sftp/distribute/input
mv  /ess/data/script/sigmet/output/*  /ess/data/script/sigmet/archive/
 


scp -r "${local_path}archive_check/"*  "/ess/data2/general/HPC/forecast_archive/Aviation/SIGMET/${year}/${month}/"

# Check if directory exists before creating
if [ ! -d "/ess/data/archive/Sigmet/${year}/${month}/" ]; then
    mkdir -p /ess/data/archive/Sigmet/${year}/${month}/
    echo "New directory in SatView for Sigmet based on year and month created."
else
    echo "Directory in SatView for Sigmet already exists."
fi

mv "${local_path}archive_check/"* "/ess/data/archive/Sigmet/${year}/${month}/"

# Check if directory exists before creating
if [ ! -d "/ess/data/archive/Sigmet_IWXXM/${year}/${month}/" ]; then
    mkdir -p /ess/data/archive/Sigmet_IWXXM/${year}/${month}/
    echo "New directory in SatView for Sigmet_IWXXM based on year and month created."
else
    echo "Directory in SatView for Sigmet_IWXXM already exists."
fi

if [ ! -d "/ess/data/archive/Sigmet_TAC/${year}/${month}/" ]; then
    mkdir -p /ess/data/archive/Sigmet_TAC/${year}/${month}/
    echo "New directory in SatView for Sigmet_TAC based on year and month created."
else
    echo "Directory in SatView for Sigmet_TAC already exists."
fi

#Step 4: Delete input files
#rm -f "${local_path}input/"*
mv "${local_path}input/"LSSR* "/ess/data/archive/Sigmet_IWXXM/${year}/${month}/" 2>/dev/null
mv "${local_path}input/"LCSR* "/ess/data/archive/Sigmet_IWXXM/${year}/${month}/" 2>/dev/null
mv "${local_path}input/"WSSR* "/ess/data/archive/Sigmet_TAC/${year}/${month}/" 2>/dev/null
mv "${local_path}input/"WCSR* "/ess/data/archive/Sigmet_TAC/${year}/${month}/" 2>/dev/null
rm ${local_path}input/*

#scp -r "${local_path}archive"/* "${local_path}output"


