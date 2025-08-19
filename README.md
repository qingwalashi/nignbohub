# 宁波边界地图（天地图）

一个基于天地图与 OpenStreetMap 的可视化小项目，用于展示宁波市不同要素（商圈、医院、学校等）的边界，并支持坐标从 WGS84 转 CGCS2000。

## 功能
- 抓取指定行政区的 OSM 要素（通过 `crawl_ningbo.py` 的 `CONFIG` 配置 `osm_tags`）
- 输出原始边界数据（WGS84，经纬度）为 JSON
- 将坐标批量转换为 CGCS2000（`convert_coords.py`）
- 在 `index.html` 中切换并展示不同数据集（`datasets.json`）

## 目录结构（节选）
- `crawl_ningbo.py`：抓取 OSM 数据脚本（按 `CONFIG` 配置城市和标签）
- `convert_coords.py`：坐标转换脚本（WGS84 -> CGCS2000）
- `datasets.json`：可在前端选择显示的数据集清单
- `index.html`、`map.js`：前端页面与逻辑
- `cache/`：临时缓存（已通过 `.gitignore` 忽略）

## 环境准备
- Python 3.9+
- 安装依赖

```bash
pip install -r requirements.txt
```

如果你在国内环境，建议配置 PyPI 镜像或使用虚拟环境。

## 数据抓取（生成原始 JSON）
1. 打开 `crawl_ningbo.py`，根据需要修改 `CONFIG`：
   - `output_filename`：输出文件名
   - `dataset_name`：数据集中文描述
   - `osm_tags`：OSM 检索标签，例如：
     - 商圈示例：
       ```python
       {
         "landuse": ["commercial", "retail"],
         "shop": "mall"
       }
       ```
     - 医院示例：
       ```python
       { "amenity": "hospital" }
       ```
     - 学校示例：
       ```python
       { "amenity": "school" }
       ```
2. 运行：
   ```bash
   python crawl_ningbo.py
   ```
3. 成功后会在项目根目录生成对应的 `*.json`（WGS84）。

## 坐标转换（WGS84 -> CGCS2000）
`convert_coords.py` 默认读取/写出：
- 输入：`ningbo_school_boundaries.json`
- 输出：`ningbo_school_boundaries_cgcs2000.json`

如需转换其他数据集，修改文件顶部的 `INPUT_FILE`、`OUTPUT_FILE` 即可：
```python
INPUT_FILE = 'ningbo_hospital_boundaries.json'
OUTPUT_FILE = 'ningbo_hospital_boundaries_cgcs2000.json'
```
运行：
```bash
python convert_coords.py
```

> 提示：若日志显示 `Successfully converted 0 coordinate points.`，通常是输入 JSON 为空或结构不符合预期，请先确保抓取脚本已正确生成数据。

## 前端预览
1. 在 `index.html` 顶部替换你的天地图 Key：
   ```html
   <script src="https://api.tianditu.gov.cn/api?v=4.0&tk=你的Key" type="text/javascript"></script>
   ```
2. 确保 `datasets.json` 中包含要展示的数据集，例如：
   ```json
   {
     "datasets": [
       { "id": "ningbo_cbd_cgcs2000", "name": "宁波商圈（CGCS2000）", "file": "ningbo_cbd_boundaries_cgcs2000.json" },
       { "id": "ningbo_hospital_cgcs2000", "name": "宁波医院边界（CGCS2000）", "file": "ningbo_hospital_boundaries_cgcs2000.json" },
       { "id": "ningbo_school_cgcs2000", "name": "宁波学校边界（CGCS2000）", "file": "ningbo_school_boundaries_cgcs2000.json" }
     ]
   }
   ```
3. 启动本地静态服务器（任选其一）：
   ```bash
   # Python 3
   python -m http.server 8000
   # 或
   python3 -m http.server 8000
   ```
4. 浏览器打开 `http://localhost:8000/`，选择侧边栏中的数据集进行查看。

## 常见问题
- 没有几何/显示为空：
  - 确认 `crawl_ningbo.py` 的 `osm_tags` 是否检索到包含几何的要素
  - 确保已执行坐标转换，并在 `datasets.json` 使用了 `*_cgcs2000.json`
- 天地图加载失败：
  - 检查 API Key 是否有效，或浏览器控制台是否有跨域/网络错误

## 许可证
根据项目需要自定义（例如 MIT）。
