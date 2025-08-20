import json
import copy
from pyproj import CRS, Transformer

# Define file paths
INPUT_FILE = 'ningbo_cbd_boundaries.json'
OUTPUT_FILE = 'ningbo_cbd_boundaries_cgcs2000.json'

def convert_coordinates():
    """
    Reads boundary data, converts coordinates from WGS 84 to CGCS2000,
    including both polylines and centroid fields, and saves the result to a new JSON file.
    """
    print(f"Loading data from {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: The file '{INPUT_FILE}' was not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from '{INPUT_FILE}'.")
        return

    converted_data = copy.deepcopy(original_data)

    # Define the coordinate systems
    # WGS 84 (used by GPS) -> EPSG:4326
    # CGCS2000 (used by Tianditu) -> EPSG:4490
    crs_wgs84 = CRS("EPSG:4326")
    crs_cgcs2000 = CRS("EPSG:4490")
    transformer = Transformer.from_crs(crs_wgs84, crs_cgcs2000, always_xy=True)

    print("Starting coordinate conversion (WGS 84 -> CGCS2000)...")
    conversion_count = 0

    # Handle different data structures - check if data has 'features' array
    if isinstance(converted_data, dict) and 'features' in converted_data:
        areas_to_process = converted_data['features']
    elif isinstance(converted_data, list):
        areas_to_process = converted_data
    else:
        print("Error: Unexpected data structure in input file.")
        return

    for area in areas_to_process:
        # Update the source field
        if 'source' in area:
            area['source'] = 'Tianditu'

        # Convert polylines coordinates
        if 'polylines' in area and isinstance(area['polylines'], list):
            new_polylines = []
            for polyline in area['polylines']:
                new_polyline = []
                for point in polyline:
                    if isinstance(point, list) and len(point) == 2:
                        lon, lat = point
                        # Perform the conversion
                        cgcs2000_lon, cgcs2000_lat = transformer.transform(lon, lat)
                        new_polyline.append([cgcs2000_lon, cgcs2000_lat])
                        conversion_count += 1
                new_polylines.append(new_polyline)
            area['polylines'] = new_polylines

        # Convert centroid coordinates
        if 'centroid' in area and isinstance(area['centroid'], list) and len(area['centroid']) == 2:
            lon, lat = area['centroid']
            # Perform the conversion
            cgcs2000_lon, cgcs2000_lat = transformer.transform(lon, lat)
            area['centroid'] = [cgcs2000_lon, cgcs2000_lat]
            conversion_count += 1

    print(f"Successfully converted {conversion_count} coordinate points.")

    print(f"Saving converted data to {OUTPUT_FILE}...")
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(converted_data, f, ensure_ascii=False, indent=4)
        print("Conversion complete!")
    except IOError as e:
        print(f"Error writing to file '{OUTPUT_FILE}': {e}")

if __name__ == "__main__":
    convert_coordinates()
