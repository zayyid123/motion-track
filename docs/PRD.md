# Product Requirements Document — Motion-Track

**Status:** Draft  
**Versi:** 1.0  
**Tanggal:** 28 Oktober 2026  
**Produk:** Motion-Track  
**Platform:** Web desktop-first

## 1. Ringkasan produk

Motion-Track adalah studio web untuk membuat ilustrasi isometrik berbentuk stiker, menambahkan animasi yang dapat dikendalikan, melihat pratinjau hasilnya, dan mengekspornya. Pengguna menyusun ilustrasi dari beberapa bagian, memilih arah pandang dan palet warna, kemudian menerapkan preset gerakan.

Produk ditujukan untuk kreator, desainer, dan pengembang yang membutuhkan ilustrasi kecil yang ekspresif untuk produk digital, onboarding, empty state, presentasi, atau konten sosial—tanpa harus membuat seluruh ilustrasi dan animasinya dari nol.

## 2. Masalah dan peluang

Membuat ilustrasi isometrik yang konsisten membutuhkan keterampilan menggambar, pengaturan perspektif, dan animasi. Alat umum sering kali terlalu bebas untuk menghasilkan gaya stiker yang konsisten, sementara animasi sederhana dapat terasa acak dan sulit disunting.

Motion-Track mengatasi hal ini dengan membatasi bentuk dan motion ke sistem yang terarah: bagian ilustrasi berlapis, tampilan isometrik yang konsisten, palet berbasis peran, serta preset animasi yang dapat dikustomisasi.

## 3. Visi dan prinsip produk

### Visi

Memudahkan siapa pun membuat stiker isometrik animasi yang terlihat konsisten, mudah dipersonalisasi, dan siap digunakan di produk digital.

### Prinsip

1. **Mudah dimulai:** pengguna dapat menghasilkan sesuatu yang menarik dari contoh dan preset, tanpa perlu memahami animasi terlebih dahulu.
2. **Tetap dapat dikendalikan:** preset mempercepat pekerjaan tetapi tidak menyembunyikan kontrol penting.
3. **Konsisten secara visual:** outline, perspektif, warna, dan kedalaman mengikuti sistem yang sama.
4. **Pratinjau langsung:** perubahan pada bentuk, warna, dan gerakan segera terlihat di kanvas.
5. **Portabel:** proyek dapat disimpan dan dibuka kembali sebagai file lokal.
6. **Aksesibel:** kontrol dapat digunakan melalui keyboard, label kontrol jelas, dan hasil menghormati preferensi reduced motion.

### Karakter & Panduan Desain Antarmuka (Design System)

- **Minimalist / Swiss-inspired:**
  - Background dominan putih bersih (`#ffffff` / neutral-50) dengan garis grid halus atau border tipis neutral.
  - Minim elemen dekoratif yang berlebihan, fokus utama langsung pada kanvas stiker dan kontrol esensial.
- **Bold Typography:**
  - Headline besar, judul section, kode, dan badge menggunakan font monospace (seperti Geist Mono / JetBrains Mono) yang memberikan karakter *developer-tool* presisi dan tajam.
  - Hirarki teks yang kontras tinggi dan mudah dipindai (*scanability*).
- **Isometric Sticker Signature Illustration:**
  - Maskot/Hero ilustrasi stiker isometrik: kombinasi pensil dan kertas dengan sudut 3D akurat, outline hitam tebal (`5px stroke`), sisi slab terkesan padat, serta palet warna pastel yang lembut.
- **Rounded UI:**
  - Kontainer, panel, modal, tombol aksi, dan kotak command menggunakan sudut membulat (*rounded-xl* / *rounded-2xl* hingga *pill-shaped*) yang ramah dan modern.
- **Soft Neutral Palette with Pink Accent:**
  - Dominasi warna: Putih murni, abu-abu netral (`#f8fafc`, `#f1f5f9`, border `#e2e8f0`).
  - Aksen utama: Pink lembut / hot pastel pink (contoh: `#f472b6`, `#ec4899`, atau `#fb7185`) sebagai titik fokus tombol CTA, active state, dan badge penting.
- **Developer-Focused Landing Section:**
  - Landing page menyajikan panduan instalasi/penggunaan langsung dalam komponen command box (terminal-style) dengan fitur *one-click copy*, contoh kode, dan tombol langsung lompat ke Studio Editor.

## 4. Sasaran dan bukan sasaran

### Sasaran MVP

- Membuat dan mengedit stiker isometrik dari bentuk dan bagian sederhana.
- Mengatur palet warna dan properti visual setiap bagian.
- Menerapkan serta mengatur preset animasi.
- Menyimpan dan membuka proyek lokal.
- Mengekspor animasi ke format video/animasi: MOV, MP4, dan GIF.
- Menyediakan pengalaman editor desktop-first yang responsif.

### Bukan sasaran MVP

- Menggambar vektor bebas dengan pen tool atau path editor lengkap.
- Akun pengguna, penyimpanan cloud, atau sinkronisasi lintas perangkat.
- Kolaborasi real-time, komentar, dan berbagi proyek berbasis izin.
- Marketplace aset atau preset dari komunitas.
- Pembuatan ilustrasi otomatis berbasis AI.
- Format output di luar MOV, MP4, dan GIF (tidak menyediakan ekspor gambar statis seperti PNG).

## 5. Pengguna sasaran

### Persona utama: desainer produk

Membutuhkan ilustrasi pendukung yang khas untuk onboarding, empty state, atau fitur produk. Mengutamakan konsistensi visual dan ekspor transparan.

### Persona sekunder: pengembang frontend

Membutuhkan aset ringan dan siap pakai untuk antarmuka web. Mengutamakan format proyek yang dapat dipahami, hasil yang konsisten, dan proses ekspor yang sederhana.

### Persona sekunder: kreator konten

Membutuhkan stiker animasi menarik untuk materi presentasi atau konten digital. Mengutamakan variasi warna, motion yang mudah diatur, dan hasil yang dapat dipratinjau.

## 6. Pengalaman dan alur utama

1. Pengguna membuka editor dan memilih **Proyek baru** atau salah satu contoh.
2. Pengguna menambahkan bentuk atau bagian ilustrasi dari panel aset.
3. Pengguna memilih bagian di kanvas atau daftar layer.
4. Pengguna mengubah bentuk, kedalaman, outline, pivot, dan posisi bagian.
5. Pengguna memilih arah pandang isometrik dan palet warna.
6. Pengguna menerapkan preset motion dan menyesuaikan parameter yang tersedia.
7. Pengguna memutar, menjeda, atau menggeser playhead untuk memeriksa animasi.
8. (Opsional) Pengguna membuka dialog Settings, memasukkan Base URL dan API Key dari provider AI yang kompatibel (misal format OpenAI API compatible), lalu menggunakan AI Sidebar Chat untuk berkonsultasi, meminta saran ide warna/motion, atau memandu pengeditan.
9. Pengguna menyimpan proyek lokal atau mengekspor animasi ke dalam format MOV, MP4, atau GIF.

## 7. Persyaratan fungsional

Prioritas: **P0** = wajib untuk MVP, **P1** = penting setelah alur utama stabil, **P2** = pengembangan lanjutan.

### 7.1 Proyek

- **P0:** Pengguna dapat memulai proyek kosong dengan nilai awal yang valid.
- **P0:** Pengguna dapat membuka contoh stiker yang dapat diedit.
- **P0:** Pengguna dapat mengganti nama proyek.
- **P0:** Pengguna dapat menyimpan proyek sebagai JSON lokal dan membuka file proyek tersebut kembali.
- **P0:** Aplikasi menampilkan status perubahan yang belum disimpan.
- **P1:** Pengguna dapat menduplikasi proyek atau stiker.
- **P1:** Aplikasi memperingatkan sebelum perubahan yang belum disimpan hilang.

### 7.2 Kanvas dan ilustrasi

- **P0:** Kanvas menampilkan latar transparan atau latar bantu yang tidak ikut diekspor.
- **P0:** Pengguna dapat menambahkan bentuk dasar: poligon, persegi, elips, garis, dan bintang.
- **P0:** Pengguna dapat memilih, memindahkan, mengubah ukuran, dan menghapus bagian.
- **P0:** Pengguna dapat mengubah urutan bagian melalui panel layer.
- **P0:** Setiap bagian mendukung fill, outline, ketebalan outline, dan kedalaman slab.
- **P0:** Bentuk dapat menggunakan arah pandang preset: kanan, kiri, depan, dan rebah.
- **P1:** Pengguna dapat mengelompokkan bagian dan mengubah pivot animasi secara visual.
- **P1:** Kanvas mendukung zoom dan reset tampilan.

### 7.3 Warna

- **P0:** Pengguna dapat memilih palet siap pakai.
- **P0:** Pengguna dapat mengubah warna peran utama melalui color picker atau input hex.
- **P0:** Bagian ilustrasi dapat menggunakan warna berdasarkan peran, misalnya `main`, `accent`, `tint`, `deep`, dan `outline`.
- **P1:** Pengguna dapat menyimpan palet kustom di dalam proyek.
- **P1:** Perubahan palet memperbarui semua bagian yang memakai peran warna terkait.

### 7.4 Motion dan timeline

- **P0:** Pengguna dapat memilih preset motion: `hop`, `bounce`, `wiggle`, `drift`, `twist`, `float`, dan `twinkle`.
- **P0:** Pengguna dapat memutar, menjeda, dan mengulang animasi.
- **P0:** Pengguna dapat mengatur intensitas dan kecepatan motion dengan kontrol yang tervalidasi.
- **P0:** Animasi memiliki keadaan diam/still yang jelas untuk pratinjau dan fallback.
- **P1:** Pengguna dapat menggeser playhead untuk melihat frame tertentu.
- **P1:** Pengguna dapat memberi motion berbeda pada bagian yang berbeda.
- **P1:** Bagian turunan dapat mengikuti gerakan induk dengan jeda atau skala gerak.
- **P2:** Pengguna dapat menyunting keyframe secara langsung dan mengatur easing lanjutan.

### 7.5 Ekspor

- **P0:** Pengguna dapat mengekspor animasi ke format video/animasi: MOV, MP4, dan GIF.
- **P0:** Dialog ekspor menyediakan pilihan format MOV, MP4, dan GIF.
- **P0:** Hasil ekspor memakai ukuran, frame rate, durasi loop, dan skala yang dapat dipilih dari preset umum.
- **P0:** Elemen bantu editor seperti grid, bounding box, selection outline, dan handle tidak muncul dalam file hasil ekspor.
- **P0:** Animasi loop diekspor secara mulus tanpa loncatan posisi (seamless loop).
- **P1:** Pengguna dapat mengatur latar belakang (solid color atau transparan bila didukung codec).
- **Catatan format:** 
  - GIF: mendukung alpha/transparansi 1-bit dengan batas warna 256.
  - MP4: default video dengan background solid/warna.
  - MOV: mendukung ProRes 4444 / alpha channel untuk software editing profesional (misal Final Cut, Premiere, After Effects).

### 7.6 AI Assistant Sidebar & Integrasi Custom AI

- **P0:** Modal / panel **Settings** untuk konfigurasi AI:
  - Input **AI Base URL** (contoh: `https://api.openai.com/v1` atau proxy/endpoint lokal/pihak ketiga yang kompatibel).
  - Input **API Key** (disimpan aman hanya di `localStorage` peramban lokal, tidak dikirim ke backend Motion-Track).
  - Input **Model Name** (default dapat dikustomisasi, misal `gpt-4o-mini`, `gemini-1.5-flash`, atau model open source).
- **P0:** **AI Chat Sidebar** di samping editor yang dapat dibuka/tutup:
  - Tampilan thread chat (pesan pengguna dan balasan AI).
  - State indikator status koneksi (siap / belum ada API Key / loading / error koneksi).
  - Mengirim prompt bantuan seputar kreasi ilustrasi stiker, ide palet warna, kombinasi motion, atau prompt deskripsi objek isometrik.
- **P1:** Context injection: AI sidebar dapat membaca ringkasan state proyek saat ini (jumlah layer, palet yang aktif, preset motion terpilih) sebagai system prompt agar saran lebih relevan.
- **P1:** Quick Action buttons di AI sidebar (misal: "Sarankan Palet Cyberpunk", "Ide Motion untuk Koin", "Jelaskan Preset Hop").

## 8. Persyaratan nonfungsional

- **Performa:** interaksi dasar kanvas terasa responsif pada komputer desktop modern; target awal pembaruan pratinjau adalah 30 FPS atau lebih untuk satu stiker kompleksitas MVP.
- **Kompatibilitas:** mendukung versi terbaru Chrome, Edge, Firefox, dan Safari desktop. Perilaku ekspor diverifikasi secara terpisah pada setiap browser.
- **Responsif:** editor dioptimalkan untuk lebar desktop/laptop; pada layar sempit, sediakan mode pratinjau dan kontrol yang disusun ulang, bukan memaksakan seluruh panel desktop.
- **Keandalan:** proyek JSON yang valid dapat dibuka kembali tanpa kehilangan properti yang didukung.
- **Aksesibilitas:** kontrol interaktif memiliki label, fokus terlihat, navigasi keyboard dasar, dan kontras teks yang memadai.
- **Privasi:** MVP tidak mengunggah proyek ke server; file proyek tetap berada di perangkat pengguna kecuali pengguna secara eksplisit mengekspornya.
- **Reduced motion:** pratinjau menghormati `prefers-reduced-motion` dan dapat menampilkan pose diam.

## 9. Struktur antarmuka

- **Toolbar atas:** nama proyek, status simpan, undo/redo (P1), playback, tombol toggle AI Chat Sidebar, tombol Settings (konfigurasi AI), dan tombol Export (MOV / MP4 / GIF).
- **Panel kiri:** pustaka bentuk/contoh dan daftar layer.
- **Kanvas tengah:** pratinjau utama, kontrol zoom, dan pemilihan bagian.
- **Panel kanan:** properti objek terpilih seperti warna, outline, kedalaman, orientasi, pivot, dan motion.
- **AI Sidebar (kanan atau dockable):** percakapan chat AI interaktif dengan input prompt, history pesan, status koneksi API, dan quick actions.
- **Area timeline bawah:** playback, playhead, durasi, loop, serta kontrol frame (bertahap: P0 playback; P1 scrubber).

## 10. Model data konseptual

Model proyek disimpan sebagai data terstruktur agar dapat divalidasi, di-undo, dan diekspor.

```ts
type Project = {
  version: number
  name: string
  canvas: { width: number; height: number; background: string | null }
  palette: Record<string, string>
  layers: Layer[]
  createdAt: string
  updatedAt: string
}

type Layer = {
  id: string
  name: string
  visible: boolean
  locked: boolean
  parentId?: string
  shape: ShapeData
  style: {
    fill: string
    outline: string
    outlineWidth: number
    depth: number
  }
  transform: { x: number; y: number; scaleX: number; scaleY: number; rotation: number }
  pivot: { x: number; y: number }
  motion?: { preset: string; intensity: number; speed: number; delay: number }
}
```

Skema di atas bersifat konseptual; implementasi dapat menyesuaikan kebutuhan renderer. `version` wajib digunakan agar format file dapat dimigrasikan saat skema berubah.

## 11. Kriteria penerimaan MVP

MVP dianggap siap untuk uji pengguna ketika:

1. Pengguna dapat membuka editor, membuat proyek, dan menambahkan setidaknya satu bentuk tanpa error.
2. Perubahan bentuk, layer, warna, dan orientasi langsung terlihat di kanvas.
3. Pengguna dapat menerapkan dan memutar minimal tujuh preset motion yang ditentukan.
4. Pengguna dapat mengatur kecepatan dan intensitas motion, menjeda animasi, dan melihat pose diam.
5. Proyek dapat disimpan ke JSON lalu dibuka kembali dengan layer dan pengaturan yang sama.
6. Pengguna dapat mengekspor animasi ke format MOV, MP4, dan GIF tanpa menyertakan elemen bantu editor.
7. Pengguna dapat membuka dialog Settings, memasukkan URL API dan API Key mereka sendiri, lalu berinteraksi via AI Chat Sidebar untuk menerima respons dan saran desain.
8. Editor dapat digunakan dengan keyboard untuk fokus, memilih kontrol, memutar/menjeda, dan menghapus layer terpilih.
9. Mode reduced motion menampilkan pose diam atau mencegah animasi otomatis.
10. Tidak ada error TypeScript, lint, atau build yang menghalangi rilis.

## 12. Metrik keberhasilan

Untuk MVP, ukur keberhasilan melalui uji pengguna dan penggunaan lokal tanpa mewajibkan analitik server:

- **Time to first sticker:** waktu dari membuka editor hingga pengguna melihat stiker bergerak pertama.
- **Completion rate:** persentase sesi uji yang berhasil menyelesaikan ekspor MOV, MP4, atau GIF.
- **Save/reopen success:** persentase proyek uji yang dapat dibuka kembali tanpa kehilangan data.
- **Export success:** persentase ekspor MOV, MP4, dan GIF yang berhasil diputar dan sesuai pratinjau.
- **AI Assist utility:** pengguna merasa terbantu dengan saran warna/motion yang diberikan AI chatbot kustom.
- **Usability feedback:** pengguna memahami panel layer, palet, dan preset tanpa bantuan langsung.

Target numerik ditetapkan setelah baseline uji pertama; jangan menganggap angka target sebelum data penggunaan tersedia.

## 13. Tahapan pengembangan

### Fase 1 — Fondasi editor
- Struktur aplikasi dan model proyek.
- Layout editor, canvas dasar, zoom, bentuk sederhana, pemilihan, dan layer.

### Fase 2 — Sistem visual & Palet
- Proyeksi isometrik, kedalaman slab, outline, arah pandang, dan palet berbasis peran.
- Contoh stiker untuk mempercepat onboarding.

### Fase 3 — Sistem motion
- Runtime animasi dan preset (hop, bounce, wiggle, drift, twist, float, twinkle).
- Playback, loop, kecepatan/intensitas, pose diam, serta reduced motion.
- Timeline sederhana dan pengaturan motion per layer.

### Fase 4 — Integrasi AI Sidebar & Settings
- Modal Settings untuk menyimpan AI Base URL & API Key di `localStorage`.
- AI Chat Sidebar client dengan antarmuka percakapan interaktif (OpenAI-compatible request).
- Prompt engineering konteks stiker isometrik & quick actions.

### Fase 5 — Pipeline Ekspor MOV, MP4, & GIF
- Capture sequence frame kanvas (client-side render loop).
- Encoding ke format GIF (animated GIF encoder), MP4 (H.264), dan MOV (ProRes / QuickTime alpha).
- Validasi hasil ekspor dan download dialog.

### Fase 6 — Penyempurnaan pasca-MVP
- Undo/redo, shortcut tambahan, pengelompokan, keyframe lanjutan.
- Kemampuan AI menerapkan modifikasi langsung ke state stiker (Function Calling / Auto-apply style).

## 14. Risiko dan mitigasi

- **Kompleksitas editor meningkat terlalu cepat:** batasi MVP ke bentuk terarah dan preset, bukan menggambar bebas atau keyframe penuh.
- **Animasi dan editor menggunakan model yang berbeda:** tetapkan model proyek serta API renderer sebelum memperluas panel UI.
- **Ekspor browser berbeda-beda:** jadikan PNG jalur ekspor MVP dan uji dukungan format animasi secara terpisah.
- **Perspektif isometrik terlihat tidak konsisten:** gunakan transform/orientasi preset dan aturan kedalaman yang seragam.
- **Proyek lokal rusak saat skema berkembang:** validasi input dan gunakan nomor versi serta migrasi format.
- **Risiko atribusi/lisensi referensi:** gunakan repo `kelvinkn17/skills` sebagai inspirasi konsep; sebelum menyalin atau mengadaptasi kode/aset, tinjau lisensi MIT dan sertakan pemberitahuan serta atribusi yang diwajibkan.

## 15. Asumsi dan keputusan terbuka

- MVP bersifat lokal dan tidak membutuhkan akun atau backend.
- Desktop/laptop adalah pengalaman utama; dukungan mobile pada MVP dibatasi ke pratinjau dan akses kontrol dasar.
- Canvas 2D merupakan opsi awal untuk pratinjau; implementasi dapat dievaluasi ulang jika kebutuhan performa atau bentuk meningkat.
- PNG adalah format ekspor pertama; format animasi ditunda hingga strategi render dan kompatibilitas ditetapkan.
- Detail lisensi dan bagian referensi yang akan diadaptasi harus ditinjau sebelum implementasi kode yang bersumber langsung dari repositori inspirasi.

## 16. Referensi

- Repo skill `fun-isometric`: <https://github.com/kelvinkn17/skills>
- Halaman skill: <https://skills.klvn.dev/fun-isometric>
- Skill tersebut mendeskripsikan ilustrasi slab isometrik, palet warna berbasis peran, rig bagian, dan preset motion sebagai referensi konsep. Motion-Track perlu mempertahankan identitas, implementasi, dan UX produknya sendiri.
