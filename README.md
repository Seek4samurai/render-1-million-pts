# How I Rendered 1 Million Points

A high-performance web-based visualization tool designed to render 1,000,000 points efficiently in the browser. This project demonstrates techniques for handling large datasets using hardware acceleration.
Basically, a demo of how we can use WebGL to handle & render these large datasets on the client side.

> ⚠️ This is **not** a traditional web application.  
> It’s a **data visualization** focused purely on performance.

---

## 🚀 Features

- ⚡ **GPU Accelerated Rendering**  
  Efficiently renders up to 1 million points using WebGL.  
  _(Performance depends on your GPU.)_

- 🧭 **Interactive Navigation**
  - Zoom
  - Pan
  - Smooth exploration of large point clouds

- 📊 **Large Dataset Handling**
  Optimized GPU buffers and rendering pipeline.

## 🛠️ Built With

- **Language:** Python / JavaScript
- **Graphics API:** WebGL
- **Bundler:** Vite

## 🏁 Getting Started

### Prerequisites

- **Node.js:** [Download Node.js](https://nodejs.org/) (v16+ recommended).
- **Python:** [Download Python](https://www.python.org/) (v3.x for data processing scripts).
- **Modern Web Browser:** A browser that supports **WebGL 2.0** (Chrome, Firefox, Edge, or Safari).

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Seek4samurai/render-1-million-pts.git
   cd render-1-million-pts
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

# What now?

From here you have your frontend ready. Now you need to setup your backend.

### **Important Note**

Frontend already has the ability to load upto 50,000 points without the need of a server. But if you want to hover over a point load its data, like which song
am I hovering on? Basically its metadata you'll need to setup the server too.

### To setup server follow this guide: [Server Setup Guide](https://github.com/Seek4samurai/render-1-million-pts-server)
