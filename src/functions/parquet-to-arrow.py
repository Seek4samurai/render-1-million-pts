import pandas as pd
import pyarrow as pa
import pyarrow.feather as feather

df = pd.read_parquet("../../public/dataset/xl/xl.parquet")
table = pa.Table.from_pandas(df)

# Set compression to None
feather.write_feather(
    table, "../../public/dataset/xl/xl_metadata.arrow", compression="uncompressed"
)
