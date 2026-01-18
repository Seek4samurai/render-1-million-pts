export const identifySong = async (x, y, i) => {
  try {
    const response = await fetch(
      `http://127.0.0.1:8000/identify?x=${x}&y=${y}&k=${i}`,
    );
    const data = await response.json();
    data.matches?.map((i) => {
      console.log(i);

      // console.log(i.energy);
    });
  } catch (err) {
    console.error("Failed to identify song:", err);
  }
};
