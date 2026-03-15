"""
# --------
# Author - Gemini 3
# --------
This Script helped me in the sharding of a 1 massive arrow and bin file
Though bin was not an issue in start, but in maintaining order it was also splitted
Run this only when want to split parquet and coords bin file...
"""

# import pandas as pd
# import pyarrow as pa
# import pyarrow.feather as feather
# import numpy as np

# df = pd.read_parquet("../../public/dataset/xl/xl.parquet")
# coords = np.fromfile("../../public/dataset/xl/xl_coords.bin", dtype=np.float32).reshape(
#     -1, 3
# )

# num_chunks = 12
# chunk_size = len(df) // num_chunks

# for i in range(num_chunks):
#     start = i * chunk_size
#     # Ensure the last chunk gets the remainder
#     end = (i + 1) * chunk_size if i < num_chunks - 1 else len(df)

#     # 1. Slice Metadata
#     chunk_df = df.iloc[start:end]
#     table = pa.Table.from_pandas(chunk_df, preserve_index=False)
#     feather.write_feather(
#         table,
#         f"../../public/dataset/xl/xl_metadata_part{i}.arrow",
#         compression="uncompressed",
#     )

#     # 2. Slice Coordinates
#     chunk_coords = coords[start:end]
#     chunk_coords.tofile(f"../../public/dataset/xl/xl_coords_part{i}.bin")

# print("Sharding complete. All files should now be ~60MB.")

import pandas as pd
import pyarrow as pa
import pyarrow.feather as feather
import numpy as np
import os

df = pd.read_parquet("../../public/dataset/xl/xl.parquet")
coords = np.fromfile("../../public/dataset/xl/xl_coords.bin", dtype=np.float32).reshape(
    -1, 3
)

# CRITICAL: Ensure dataframe and coordinates are the exact same length
min_len = min(len(df), len(coords))
df = df.iloc[:min_len]
coords = coords[:min_len]

num_chunks = 9
chunk_size = int(np.ceil(len(df) / num_chunks))

for i in range(num_chunks):
    start = i * chunk_size
    end = min((i + 1) * chunk_size, len(df))

    # Skip if for some reason start >= end (prevents 0kb files)
    if start >= end:
        print(f"Skipping part {i} - no data remaining")
        continue

    # Slice Metadata
    chunk_df = df.iloc[start:end]
    table = pa.Table.from_pandas(chunk_df, preserve_index=False)
    feather.write_feather(
        table,
        f"../../public/dataset/xl/shard/xl_metadata_part{i}.arrow",
        compression="uncompressed",
    )

    # Slice Coordinates
    chunk_coords = coords[start:end]
    chunk_coords.tofile(f"../../public/dataset/xl/shard/xl_coords_part{i}.bin")

    print(f"Part {i}: {len(chunk_df)} rows saved.")
