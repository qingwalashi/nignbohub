import osmnx as ox
import json
import os
import logging
from shapely.geometry import Polygon, MultiPolygon

# --- 全局配置 ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

CONFIG = {
    # 1. 定义最终导出的 JSON 文件名
    "output_filename": "ningbo_cbd_boundaries.json",
    # 1.1 定义数据集名称（写入 JSON 顶部，英文字段）
    "dataset_name": "宁波商圈边界天地图数据",

    # 2. 指定要查询的城市与区县列表
    #    键为中文名称，值为供 OSMnx 查询使用的英文地名
    "places_to_query": {
        "city": "宁波市",
        "counties": {
            "海曙区": "Haishu, Ningbo",
            "江北区": "Jiangbei, Ningbo",
            "镇海区": "Zhenhai, Ningbo",
            "北仑区": "Beilun, Ningbo",
            "鄞州区": "Yinzhou, Ningbo",
            "奉化区": "Fenghua, Ningbo",
            "慈溪市": "Cixi, Ningbo",
            "余姚市": "Yuyao, Ningbo",
            "宁海县": "Ninghai, Ningbo",
            "象山县": "Xiangshan, Ningbo",
        }
    },

    # 3. 定义用于检索的 OpenStreetMap 标签
    #    下面示例用于检索商业及零售用地
    "osm_tags": {
        "landuse": ["commercial", "retail"],
        "shop": "mall"
    }
    #    下面示例用于检索医院
    # "osm_tags": {
    #     "amenity": "hospital"
    # }
    #    下面示例用于检索学校
    # "osm_tags": {
    #     "amenity": "school"
    # }
}

# --- 核心函数 ---

def fetch_osm_features(place_name, tags):
    """
    使用 OSMnx 从 OpenStreetMap 抓取地理要素。

    参数:
        place_name (str): 要查询的地名（例如："Ningbo, China"）。
        tags (dict): 用于筛选的 OSM 标签字典。

    返回:
        geopandas.GeoDataFrame: 包含抓取结果的 GeoDataFrame；若出错返回 None。
    """
    logging.info(f"Downloading data for '{place_name}' with tags: {tags}")
    logging.info("This process might take a few minutes. Please be patient.")
    try:
        gdf = ox.features_from_place(place_name, tags)
        logging.info(f"Download complete. Found {len(gdf)} matching features.")
        return gdf
    except Exception as e:
        logging.error(f"An error occurred during download: {e}")
        logging.error("Please check your network connection or try a more specific place name.")
        return None

def process_geometries(gdf, city, county):
    """
    处理 GeoDataFrame，将几何数据提取为所需的边界数据格式。

    参数:
        gdf (geopandas.GeoDataFrame): 包含 OSM 要素的 GeoDataFrame。
        city (str): 城市名称，将写入结果。
        county (str): 区县名称，将写入结果。

    返回:
        list: 由字典构成的列表，每个字典代表一个要素。
    """
    if gdf is None or gdf.empty:
        logging.warning("Input GeoDataFrame is empty. No data to process.")
        return []

    gdf = gdf[gdf['name'].notna()]
    logging.info(f"Filtered to {len(gdf)} features with names.")

    processed_data = []
    for index, row in gdf.iterrows():
        geometry = row.get('geometry')
        if not geometry or not hasattr(geometry, 'geom_type'):
            continue

        # 获取要素的中心点坐标
        centroid = None
        if hasattr(geometry, 'centroid'):
            centroid = [geometry.centroid.x, geometry.centroid.y]
        elif geometry.geom_type == 'Point':
            centroid = [geometry.x, geometry.y]

        polygons = []
        if geometry.geom_type == 'Polygon':
            polygons.append(geometry)
        elif geometry.geom_type == 'MultiPolygon':
            polygons.extend(geometry.geoms)
        elif geometry.geom_type == 'Point':
            # 如果是点要素，创建一个仅包含该点的"边界"
            polygons.append(geometry.buffer(0.0001))  # 创建一个小的缓冲区作为边界

        if not polygons:
            continue

        polylines = []
        for poly in polygons:
            if isinstance(poly, Polygon) and poly.exterior:
                coords = list(poly.exterior.coords)
                polylines.append([[lon, lat] for lon, lat in coords])

        if polylines:
            feature_data = {
                "city": city,
                "county": county,
                "name": row.get('name'),
                "source": "OpenStreetMap",
                "geometry_type": geometry.geom_type,
                "polylines": polylines
            }
            
            # 如果成功获取中心点坐标，则添加到数据中
            if centroid is not None:
                feature_data["centroid"] = centroid
                
            processed_data.append(feature_data)

    return processed_data

def save_data_to_json(data, output_filename):
    """
    将处理后的数据保存为 JSON 文件（包含顶层 dataset_name 字段）。

    参数:
        data (list): 要保存的数据。
        output_filename (str): 输出文件路径。
    """
    try:
        output_obj = {
            "dataset_name": CONFIG.get("dataset_name", "dataset"),
            "features": data
        }
        with open(output_filename, 'w', encoding='utf-8') as f:
            json.dump(output_obj, f, ensure_ascii=False, indent=4)
        logging.info(f"\n--- Success ---")
        logging.info(f"Successfully extracted {len(data)} features.")
        logging.info(f"Data saved to: {os.path.abspath(output_filename)}")
    except IOError as e:
        logging.error(f"Failed to write to file {output_filename}: {e}")

def main():
    """
    主函数：驱动数据抓取与处理流程。
    """
    all_processed_data = []
    city_name = CONFIG["places_to_query"]["city"]
    places = CONFIG["places_to_query"]["counties"]
    osm_tags = CONFIG["osm_tags"]
    output_file = CONFIG["output_filename"]

    for county_name, place_query in places.items():
        logging.info(f"--- Processing: {city_name} {county_name} ---")
        gdf = fetch_osm_features(place_query, osm_tags)
        processed_data = process_geometries(gdf, city_name, county_name)
        if processed_data:
            all_processed_data.extend(processed_data)
            logging.info(f"Found {len(processed_data)} features in {county_name}.")
        else:
            logging.info(f"No features found in {county_name}.")

    if all_processed_data:
        save_data_to_json(all_processed_data, output_file)
    else:
        logging.warning("No data was processed for any area. Exiting.")

if __name__ == "__main__":
    main()