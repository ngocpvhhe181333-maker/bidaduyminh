# bidaduyminh

Repository: https://github.com/ngocpvhhe181333-maker/bidaduyminh

Ứng dụng quản lý quán bi-a 5 bàn, 1 nhân viên. Giao diện dùng React JavaScript + Vite; dự kiến dùng Supabase cho dữ liệu và đăng nhập, Vercel để triển khai. Xem [danh sách chức năng](./CHUC_NANG.md).

> Hiện tại đây là bộ khung React và tài liệu dự án. Chức năng quản lý quán và kết nối Supabase chưa được lập trình.

## Chạy trên máy

Yêu cầu Node.js và npm.

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (thường là `http://localhost:5173`).

## Chuẩn bị Supabase

1. Tạo một project tại [Supabase Dashboard](https://supabase.com/dashboard).
2. Trong mục **Connect** của project, lấy **Project URL** và **publishable key**.
3. Sao chép `.env.example` thành `.env.local`, rồi điền hai giá trị đó.
4. Khi bắt đầu lập trình kết nối, cài thư viện bằng `npm install @supabase/supabase-js`.
5. Tạo các bảng và chính sách Row Level Security (RLS) cho hai vai trò Admin, Thu ngân trước khi đưa dữ liệu thật vào ứng dụng.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Biến có tiền tố `VITE_` được đưa vào mã chạy trên trình duyệt. Chỉ dùng **publishable key** ở đây; không đưa `service_role` hoặc secret key vào React, GitHub hay biến `VITE_`. Quyền truy cập dữ liệu phải được thực thi bằng RLS.

## Triển khai bằng Vercel

1. Đăng nhập [Vercel](https://vercel.com/) và chọn **Add New → Project**.
2. Import repository GitHub `ngocpvhhe181333-maker/bidaduyminh`.
3. Chọn framework **Vite**; build command `npm run build`; output directory `dist`.
4. Trong **Environment Variables**, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` giống `.env.local`.
5. Deploy. Khi đổi biến môi trường, triển khai lại để bản build mới nhận giá trị.

File `vercel.json` giúp các đường dẫn trong ứng dụng React hoạt động khi mở trực tiếp hoặc tải lại trang.

## Lệnh hữu ích

- `npm run build`: tạo bản triển khai trong `dist/`.
- `npm run preview`: xem bản build trên máy.
- `npm run lint`: kiểm tra mã nguồn bằng Oxlint.

Trang chính nằm trong `src/App.jsx`; CSS nằm trong `src/App.css` và `src/index.css`.
