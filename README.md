# bidaduyminh

Repository: https://github.com/ngocpvhhe181333-maker/bidaduyminh

Ứng dụng quản lý quán bi-a 5 bàn, 1 nhân viên. Giao diện dùng React JavaScript + Vite; dữ liệu, phân quyền (RLS) và đăng nhập dùng Supabase; triển khai trên Vercel. Xem chi tiết yêu cầu tại [danh sách chức năng](./CHUC_NANG.md).

## Chạy trên máy

Yêu cầu Node.js và npm.

```bash
npm install
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal (thường là `http://localhost:5173`).

> **Chế độ Demo cục bộ:** Nếu chưa tạo file `.env.local`, ứng dụng tự chạy ở chế độ dùng thử cục bộ (dữ liệu lưu trên `localStorage`) để bạn kiểm tra ngay giao diện và toàn bộ luồng nghiệp vụ với 2 nút đăng nhập nhanh **Thu ngân** và **Admin**. Khi cấu hình `.env.local` hợp lệ, ứng dụng sẽ tự chuyển sang chạy hoàn toàn với Supabase.

## Chuẩn bị Supabase

1. Tạo một project tại [Supabase Dashboard](https://supabase.com/dashboard).
2. Vào **SQL Editor** và chạy toàn bộ nội dung file [`supabase/schema.sql`](./supabase/schema.sql) để khởi tạo các bảng, ràng buộc chống mở trùng bàn/ca, hàm tính tiền giờ, các RPC nghiệp vụ và chính sách **Row Level Security (RLS)** cho Admin và Thu ngân (kèm sẵn 5 bàn và thực đơn mẫu).
   Sau đó chạy [`supabase/retail_sales_migration.sql`](./supabase/retail_sales_migration.sql) để bật tính năng bán đồ ăn/uống cho khách không dùng bàn. Nếu bạn đã chạy `schema.sql` từ trước, **chỉ cần chạy file migration này**; dữ liệu và hóa đơn cũ được giữ lại.
   Tiếp theo chạy [`supabase/inventory_profit_migration.sql`](./supabase/inventory_profit_migration.sql) để thêm tồn kho, giá nhập và chi phí vận hành. Với cơ sở dữ liệu đã có, chỉ chạy các file migration còn thiếu theo thứ tự; không cần chạy lại `schema.sql`.
3. Trong mục **Connect** của project, lấy **Project URL** và **publishable key**.
4. Sao chép `.env.example` thành `.env.local`, rồi điền hai giá trị đó.
   Nếu đã kết nối Supabase qua Vercel Integration, Vercel tự thêm `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Ứng dụng cũng đọc được hai tên biến này; không cần tạo thêm biến `VITE_` trên Vercel.
5. Đăng ký tài khoản của chủ quán bằng email của bạn. Mọi tài khoản tự đăng ký đều ở trạng thái chờ kích hoạt. Trong **SQL Editor**, thay email mẫu bên dưới bằng email vừa đăng ký rồi chạy lệnh để cấp quyền Admin:
   ```sql
   UPDATE public.profiles
   SET role = 'admin', is_active = true
   WHERE email = 'email-chu-quan@example.com';
   ```
   Kiểm tra kết quả bằng `SELECT email, role, is_active FROM public.profiles;`. Sau đó đăng nhập lại. Chỉ người có quyền vào Supabase Dashboard mới nên chạy bước này.
6. Tài khoản nhân viên tự đăng ký sẽ là Thu ngân chờ Admin kích hoạt trong tab **Quản trị → Tài khoản**.
7. *(Tùy chọn)* Để Admin tạo trực tiếp tài khoản nhân viên mới ngay trên web mà không lộ `service_role`, triển khai Edge Function [`supabase/functions/admin-create-user/index.ts`](./supabase/functions/admin-create-user/index.ts):
   ```bash
   supabase functions deploy admin-create-user
   ```

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Biến có tiền tố `VITE_` được đưa vào mã chạy trên trình duyệt. Chỉ dùng **publishable key** ở đây; không đưa `service_role` hoặc secret key vào React, GitHub hay biến `VITE_`. Quyền truy cập dữ liệu phải được thực thi bằng RLS.

## Triển khai bằng Vercel

1. Đăng nhập [Vercel](https://vercel.com/) và chọn **Add New → Project**.
2. Import repository GitHub `ngocpvhhe181333-maker/bidaduyminh`.
3. Chọn framework **Vite**; build command `npm run build`; output directory `dist`.
4. Trong **Environment Variables**, kiểm tra project có `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` từ Supabase Integration ở môi trường **Production**. Nếu không dùng Integration, thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` thủ công.
5. Deploy. Khi đổi biến môi trường, triển khai lại để bản build mới nhận giá trị.

File `vercel.json` giúp các đường dẫn trong ứng dụng React hoạt động khi mở trực tiếp hoặc tải lại trang.

## Bán lẻ không dùng bàn

Sau khi chạy migration và bản Vercel mới được triển khai, mở ca rồi vào tab **Bán lẻ**. Chọn món, số lượng và phương thức thanh toán; hóa đơn xuất hiện trong **Ca & Hóa đơn** với loại **Bán lẻ**. Tiền bán lẻ cộng vào doanh thu ca và báo cáo, nhưng không cộng vào số phiên chơi hay doanh thu giờ của bàn.

## Tồn kho và lợi nhuận

- Trong **Quản trị → Thực đơn**, Admin nhập giá nhập mỗi đơn vị, giá bán và số lượng tồn kho hiện tại. Để trống tồn kho nghĩa là chưa theo dõi số lượng; để trống giá nhập nghĩa là chưa tính được giá vốn.
- Món gắn với bàn trừ kho khi gọi; giảm/xóa món trước khi thanh toán sẽ hoàn lại kho. Bán lẻ trừ kho khi thanh toán. Món hết tồn không thể bán tiếp cho tới khi Admin nhập thêm tồn kho.
- Giá vốn được lưu trên từng dòng hóa đơn mới. **Báo cáo** tính lãi gộp = doanh thu − giá vốn; lãi ròng = lãi gộp − chi phí vận hành do Admin nhập. Tiền mua hàng đã nằm trong giá vốn, không nhập thêm ở mục chi phí vận hành.
- Hủy hóa đơn sau thanh toán không tự hoàn tồn kho vì hàng có thể đã được phục vụ. Nếu hàng được trả lại thực tế, Admin chỉnh số lượng tồn trong **Quản trị → Thực đơn**.
- Hóa đơn tạo trước migration không có giá vốn lịch sử. Báo cáo sẽ hiển thị **Chưa đủ dữ liệu** cho lãi nếu khoảng ngày chọn có các dòng món cũ đó; nhập giá mua hiện tại không thể suy ra giá mua cũ.

## Lệnh hữu ích

- `npm run build`: tạo bản triển khai trong `dist/`.
- `npm run preview`: xem bản build trên máy.
- `npm run lint`: kiểm tra mã nguồn bằng Oxlint.

Trang chính nằm trong `src/App.jsx`; CSS nằm trong `src/App.css` và `src/index.css`.
