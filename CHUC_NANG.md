# Chức năng quản lý quán bi-a

## Phạm vi

- Quán có 5 bàn và 1 nhân viên thu ngân.
- Hai tài khoản: Admin (chủ quán) và Thu ngân (nhân viên).
- Không có chức năng đặt bàn.
- Giao diện React; dữ liệu và đăng nhập dùng Supabase; triển khai trên Vercel.

## Chức năng cần có để vận hành

### 1. Màn hình 5 bàn

- Hiển thị rõ từng bàn: **Trống**, **Đang chơi** hoặc **Bảo trì**.
- Bàn đang chơi hiển thị giờ bắt đầu, thời gian đã chơi và số tiền tạm tính.
- Thu ngân mở phiên chơi từ bàn trống và kết thúc phiên khi khách thanh toán.
- Không cho mở hai phiên chơi đồng thời trên cùng một bàn.

### 2. Tính tiền giờ

- Admin thiết lập giá chơi theo bàn hoặc loại bàn, cùng quy tắc làm tròn thời gian.
- Hệ thống lưu giờ bắt đầu và giờ kết thúc, tự tính tiền theo cấu hình.
- Giá và quy tắc áp dụng cho phiên chơi được lưu lại để hóa đơn cũ không đổi khi Admin sửa bảng giá.
- Cho phép chuyển bàn đang chơi; thời gian và các món đã gọi đi theo phiên chơi.

### 3. Bán đồ uống và đồ ăn

- Admin quản lý danh sách món, giá bán và trạng thái còn bán/ngừng bán.
- Thu ngân thêm hoặc bỏ món khỏi phiên chơi trước khi thanh toán.
- Hóa đơn thể hiện riêng tiền giờ chơi, từng món và tổng tiền.
- Khách không chơi bi-a vẫn có thể mua món qua tab **Bán lẻ**; đơn này không cần mở bàn, nhưng cần ca làm đang mở và được tính vào doanh thu ca.

### 4. Thanh toán và hóa đơn

- Thu ngân xem trước số tiền, xác nhận thanh toán bằng tiền mặt hoặc chuyển khoản.
- Sau thanh toán, phiên chơi đóng và bàn trở lại trạng thái trống.
- Lưu hóa đơn gồm thời điểm, bàn, thời lượng, chi tiết tiền, phương thức thanh toán và người thu tiền.
- Có thể xem lại và in hóa đơn; không xóa hóa đơn đã thanh toán.
- Việc giảm giá, hủy hoặc sửa giao dịch đã thanh toán cần quyền Admin và phải lưu lý do.

### 5. Ca làm và đối soát tiền

- Thu ngân mở ca với số tiền mặt đầu ca và chốt ca với số tiền mặt thực đếm.
- Hệ thống tổng hợp doanh thu tiền mặt, chuyển khoản và khoản chênh lệch cuối ca.
- Admin xem được lịch sử ca và người thực hiện.

### 6. Báo cáo cơ bản

- Doanh thu theo ngày và theo ca; tách tiền giờ chơi và tiền bán món.
- Số phiên chơi và tổng thời gian sử dụng của từng bàn.
- Danh sách hóa đơn, có lọc theo ngày, bàn và phương thức thanh toán.

### 7. Đăng nhập và phân quyền

| Thao tác | Admin | Thu ngân |
| --- | --- | --- |
| Vận hành bàn, thêm món, thu tiền | Có | Có |
| Xem hóa đơn và doanh thu ca của mình | Có | Có |
| Xem toàn bộ báo cáo | Có | Không |
| Sửa giá, bàn, thực đơn | Có | Không |
| Giảm giá, hủy/sửa giao dịch đã thanh toán | Có | Không |
| Quản lý tài khoản | Có | Không |

Quyền phải được kiểm tra ở Supabase, không chỉ ẩn nút trên giao diện.

## Quy trình sử dụng hằng ngày

1. Thu ngân đăng nhập và mở ca.
2. Khi khách vào, thu ngân chọn bàn trống và mở phiên chơi.
3. Trong lúc chơi, thu ngân thêm món hoặc chuyển bàn nếu cần.
4. Khi khách rời quán, thu ngân xem tiền giờ và tiền món, xác nhận thanh toán.
5. Cuối ngày, thu ngân chốt ca; Admin xem doanh thu và đối soát.

## Để sau bản đầu tiên

Quản lý tồn kho chi tiết, khách hàng thân thiết, khuyến mãi tự động và tích hợp máy in chuyên dụng chỉ cần bổ sung khi quán thực sự sử dụng.
