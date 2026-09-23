# WMS - Warehouse Management System

ระบบบริหารจัดการคลังสินค้า (Warehouse Management System) ควบคุมสต็อก Real-time, Barcode Scanner, ใบเบิกสินค้า, ระบบจัดเส้นทาง Picking, Packing, Shipping และ KPI Dashboard

## เทคโนโลยี

React 19 + Vite 6 + Tailwind 4 (frontend) / Express (backend) / File-based state store + multi-device SSE sync

## Deploy (ฟรี)

<a href="https://render.com/deploy?repo=https://github.com/yodpetmalai-dev/wms">
  <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render" />
</a>

กดปุ่มด้านบน → เข้าสู่ระบบด้วย GitHub → กด **Apply** → รอ 2-5 นาที → ได้ URL

## Run ท้องถิ่น (dev)

```bash
npm install
npm run dev   # http://localhost:3000
```

Build + run production:

```bash
npm run build
npm start
```