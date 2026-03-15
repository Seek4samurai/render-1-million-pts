import pandas as pd
import pyarrow.parquet as pq

parquet_file = pq.ParquetFile("../../public/dataset/xl/xl.parquet")
print("--- Schema and Types ---")
print(parquet_file.schema)

df_sample = pd.read_parquet(
    "../../public/dataset/xl/xl.parquet", engine="pyarrow"
).head(100)

print("\n--- Memory Usage per Column (estimate for full dataset) ---")
print(df_sample.memory_usage(deep=True))
