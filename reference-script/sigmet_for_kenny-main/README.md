# README for SIGMET_fnl3_v3.py

## SIGMET Processing Script

This script processes SIGMET (Significant Meteorological Information) data and generates visualizations and XML files for further analysis and dissemination.

## Prerequisites

The script relies on several Python libraries to function properly. These include `xml.etree.ElementTree` for XML parsing, `geopandas` for handling geographic data, `matplotlib` for plotting, `numpy` for numerical operations, `shapely.geometry` for geometric operations, and various others for file handling, logging, and cartographic features.

## Usage

To use the script, ensure your input files are stored in the specified input directory (`/ess/data/script/sigmet/input`). Then, execute the script, which will process the input files and generate output images and XML files. These generated files will be stored in the designated output directories.

## Configuration

- **Input/Output Directories**: Specify directories for input files, output images, and XML files.
- **Shapefile Paths**: Provide paths to shapefiles containing ASEAN coastline data and FIR boundaries.
- **Logging**: Configure directories for storing log files.

## Features

- **Cancellation Detection**: The script identifies cancelled SIGMETs by detecting the presence of "CNL" in the input TAC messages. It generates corresponding output images indicating the cancellation.
- **Visualization**: Utilizing `matplotlib` and `cartopy`, the script creates visualizations of SIGMET data overlaid on regional maps. This aids in understanding the geographic extent of SIGMETs.
- **XML Generation**: The script constructs XML files containing SIGMET information extracted from input TAC and IWXXM messages. This enables further analysis or dissemination of SIGMET data.

## Logging

The script incorporates logging functionality to record detailed information and handle errors. Log files are stored in the specified log directory, facilitating troubleshooting and monitoring of script execution.

## Limitations

- **Directory Structure**: The script assumes specific directory structures and file naming conventions. It is crucial to configure these correctly to ensure the script functions as intended.
- **Error Handling**: While the script employs logging for error handling, it may lack extensive error recovery mechanisms. Users should monitor log files for any issues encountered during script execution.

## Note

This README provides a high-level overview of the script's functionality and usage. For comprehensive implementation details and instructions, users should refer to the script's source code, which contains comments and documentation explaining each component and its purpose. Additionally, customization of directory paths and parameters may be required based on specific use cases and data sources.

Also the data flows can be admitted to only a single output folder where even the cancellation is read from the same folder such that the cancellation sigmet can still be generated even if the input folder consists of data from the issue and cancellation sigmet.


# README for sigmet_FIR.sh

## SIGMET Data Processing Bash Script

This Bash script automates the process of fetching SIGMET (Significant Meteorological Information) data from a remote server, processing it with a Python script, and distributing the output to designated locations.

## Overview

The script performs the following steps:

1. Checks if directories for storing output files based on the current year and month exist. If not, it creates them.
2. Pulls SIGMET files from a remote server path based on specific criteria (`*WSSS*` in the filename) to a local directory for processing.
3. Executes a Python script (`SIGMET_fnl3.py`) for processing the fetched data.
4. Sends the output back to the script server for further distribution.
5. Archives the output and sends it to specified directories in the local archive system.
6. Deletes the processed input files.

## Configuration

- **Variables**: Configure username, remote server details, remote and local paths, and paths to the Python script and archive directories.
- **File Transfer**: Modify the `scp` and `ssh` commands as necessary to match your server setup and file paths.
- **Directory Creation**: Customize directory paths for creating year and month-based directories as needed.
- **File Deletion**: Update file patterns and paths for deleting input files after processing.

## Usage

Ensure the script is configured correctly with the appropriate paths and server details. Then, execute the script to automate the processing of SIGMET data.

## Note

This README provides an overview of the SIGMET processing Bash script and its functionality. For detailed implementation and customization instructions, refer to the script's source code, which contains comments explaining each step and variable. Additionally, ensure proper permissions and server access are set up for successful execution of the script.
