# BAB 3 - Diagram Mermaid

Kumpulan diagram Mermaid untuk BAB 3 Metodologi Penelitian.
Buka di https://mermaid.live/ untuk melihat dan export diagram.

---

## Gambar 3.1: Kerangka Design Science Research

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333', 'secondaryColor': '#e0e0e0', 'tertiaryColor': '#fff'}}}%%
flowchart LR
    subgraph ENV["LINGKUNGAN"]
        direction TB
        E1["Dapur Hotel"]
        E2["Manajemen Staf"]
        E3["Masalah<br/>Penjadwalan Shift"]
    end

    subgraph RES["PENELITIAN"]
        direction TB
        R1["Pengembangan"]
        A1["ARTEFAK:<br/>Pengoptimal Jadwal"]
        R2["Evaluasi"]
        R1 --> A1 --> R2
    end

    subgraph KB["BASIS PENGETAHUAN"]
        direction TB
        K1["OR-Tools CP-SAT"]
        K2["Constraint<br/>Programming"]
        K3["Optimisasi<br/>Soft Constraint"]
    end

    ENV -->|"Relevansi"| RES
    KB -->|"Rigor"| RES

    RES --> EVAL

    subgraph EVAL["JUSTIFIKASI / EVALUASI"]
        direction TB
        EV1["Metrik Kualitas Jadwal"]
        EV2["Tingkat Kepuasan Constraint"]
        EV3["Analisis Waktu Komputasi"]
        EV4["Pengujian Penerimaan Pengguna"]
    end

    style ENV fill:#f5f5f5,stroke:#333,stroke-width:2px
    style RES fill:#e8e8e8,stroke:#333,stroke-width:2px
    style KB fill:#f5f5f5,stroke:#333,stroke-width:2px
    style EVAL fill:#d9d9d9,stroke:#333,stroke-width:2px
    style A1 fill:#fff,stroke:#333,stroke-width:2px
```

---

## Gambar 3.2: Matriks Variabel Keputusan

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph MATRIX["MATRIKS VARIABEL KEPUTUSAN"]
        direction LR
        subgraph S1["Staf s₁"]
            direction TB
            S1H["t₁ | t₂ | ..."]
            S1W["K: 0 | 1 | ..."]
            S1O["L: 1 | 0 | ..."]
            S1E["P: 0 | 0 | ..."]
            S1L["S: 0 | 0 | ..."]
        end
        subgraph S2["Staf s₂"]
            direction TB
            S2H["t₁ | t₂ | ..."]
            S2W["K: 1 | 0 | ..."]
            S2O["L: 0 | 1 | ..."]
            S2E["P: 0 | 0 | ..."]
            S2L["S: 0 | 0 | ..."]
        end
        subgraph SN["Staf sₙ"]
            direction TB
            SNH["t₁ | t₂ | ..."]
            SNW["K: 0 | 1 | ..."]
            SNO["L: 1 | 0 | ..."]
            SNE["P: 0 | 0 | ..."]
            SNL["S: 0 | 0 | ..."]
        end
    end

    CONSTRAINT["Constraint: ∀s,t: Σ shifts[s,t,j] = 1"]
    LEGEND["K=KERJA, L=LIBUR, P=PAGI, S=SORE"]

    MATRIX --> CONSTRAINT
    CONSTRAINT --> LEGEND

    style MATRIX fill:#f5f5f5,stroke:#333,stroke-width:2px
    style CONSTRAINT fill:#e0e0e0,stroke:#333,stroke-width:1px
    style LEGEND fill:#fff,stroke:#333,stroke-width:1px
```

---

## Gambar 3.3: Piramida Hierarki Constraint

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph PYRAMID["HIERARKI CONSTRAINT"]
        direction TB

        H1["HARD CONSTRAINT<br/>Harus dipenuhi 100%"]
        H2["Satu Shift Per Hari<br/>Sel Pre-filled<br/>Aturan Kalender"]

        S1["SOFT - PRIORITAS TERTINGGI<br/>Kepatuhan Regulasi Kerja"]
        S1D["Istirahat 5-Hari<br/>penalti = 200"]

        S2["SOFT - PRIORITAS TINGGI<br/>Keadilan dan Cakupan"]
        S2D["Grup Staf: 100<br/>Batas Bulanan: 80"]

        S3["SOFT - PRIORITAS SEDANG<br/>Keseimbangan Operasional"]
        S3D["Tipe Staf: 60<br/>Batas Harian: 50"]

        S4["SOFT - PRIORITAS RENDAH<br/>Kualitas Hidup"]
        S4D["Konflik Berdekatan: 30"]
    end

    H1 --> H2
    H2 --> S1
    S1 --> S1D
    S1D --> S2
    S2 --> S2D
    S2D --> S3
    S3 --> S3D
    S3D --> S4
    S4 --> S4D

    style H1 fill:#333,stroke:#333,color:#fff
    style H2 fill:#4a4a4a,stroke:#333,color:#fff
    style S1 fill:#666,stroke:#333,color:#fff
    style S1D fill:#808080,stroke:#333,color:#fff
    style S2 fill:#999,stroke:#333,color:#000
    style S2D fill:#b3b3b3,stroke:#333,color:#000
    style S3 fill:#ccc,stroke:#333,color:#000
    style S3D fill:#e0e0e0,stroke:#333,color:#000
    style S4 fill:#f0f0f0,stroke:#333,color:#000
    style S4D fill:#fff,stroke:#333,color:#000
```

---

## Gambar 3.4: Arsitektur Solver CP-SAT

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph INPUT["LAPISAN INPUT"]
        I1["Data Staf"]
        I2["Rentang<br/>Tanggal"]
        I3["Constraint"]
        I4["Data<br/>Pre-filled"]
    end

    subgraph MODEL["PEMBANGUN MODEL"]
        M1["Variabel Boolean<br/>shifts s,d,t"]
        M2["Hard Constraint<br/>ExactlyOne"]
        M3["Soft Constraint<br/>OnlyEnforceIf"]
    end

    subgraph SOLVER["MESIN SOLVER CP-SAT"]
        subgraph WORKERS["WORKER PENCARIAN PARALEL"]
            W1["Worker 1<br/>SAT"]
            W2["Worker 2<br/>CP"]
            W3["Worker 3<br/>LNS"]
            W4["Worker 4<br/>LP"]
        end
        SHARE["Berbagi<br/>Solusi Terbaik"]
    end

    subgraph OUTPUT["LAPISAN OUTPUT"]
        O1["Matriks<br/>Jadwal"]
        O2["Status Solusi<br/>OPTIMAL/FEASIBLE"]
        O3["Daftar<br/>Pelanggaran"]
        O4["Statistik"]
    end

    INPUT --> MODEL
    I1 --> M1
    I2 --> M1
    I3 --> M2
    I3 --> M3
    I4 --> M2

    MODEL --> SOLVER
    M1 --> WORKERS
    M2 --> WORKERS
    M3 --> WORKERS

    W1 --> SHARE
    W2 --> SHARE
    W3 --> SHARE
    W4 --> SHARE

    SOLVER --> OUTPUT
    SHARE --> O1
    SHARE --> O2
    SHARE --> O3
    SHARE --> O4

    style INPUT fill:#f5f5f5,stroke:#333,stroke-width:2px
    style MODEL fill:#e8e8e8,stroke:#333,stroke-width:2px
    style SOLVER fill:#d9d9d9,stroke:#333,stroke-width:2px
    style WORKERS fill:#ccc,stroke:#333,stroke-width:1px
    style OUTPUT fill:#f5f5f5,stroke:#333,stroke-width:2px
    style SHARE fill:#fff,stroke:#333,stroke-width:1px
```

---

## Gambar 3.5: Arsitektur Sistem

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph UI["LAPISAN ANTARMUKA PENGGUNA - React + Tailwind"]
        direction LR
        UI1["Tabel<br/>Jadwal"]
        UI2["Daftar<br/>Staf"]
        UI3["Panel<br/>Constraint"]
        UI4["Modul<br/>Ekspor"]
    end

    subgraph APP["LAPISAN APLIKASI - React Hooks"]
        APP1["useAIAssistant<br/>Kumpulkan constraint"]
        APP2["useScheduleData<br/>Kelola state"]
        APP3["useStaffData<br/>Operasi CRUD"]
    end

    subgraph OPT["LAPISAN OPTIMISASI - Python Flask + OR-Tools"]
        subgraph OPTCLASS["ShiftScheduleOptimizer"]
            OPT1["optimize_schedule"]
            OPT2["_create_variables"]
            OPT3["_add_basic_constraints"]
            OPT4["_add_prefilled_constraints"]
            OPT5["_add_staff_group_constraints"]
            OPT6["_add_daily_limits"]
            OPT7["_add_monthly_limits"]
            OPT8["_add_5_day_rest_constraint"]
            OPT9["_add_objective"]
            OPT10["_extract_solution"]
        end
        CPSAT["CP-SAT Solver<br/>Jadwal Optimal"]
    end

    subgraph DATA["LAPISAN DATA - Supabase PostgreSQL"]
        direction LR
        D1["Tabel<br/>Staf"]
        D2["Tabel<br/>Jadwal"]
        D3["Tabel<br/>Periode"]
        D4["Pengaturan"]
    end

    UI --> APP
    APP -->|"POST /optimize"| OPT
    OPT --> DATA

    OPT1 --> OPT2
    OPT2 --> OPT3
    OPT3 --> OPT4
    OPT4 --> OPT5
    OPT5 --> OPT6
    OPT6 --> OPT7
    OPT7 --> OPT8
    OPT8 --> OPT9
    OPT9 --> OPT10
    OPT10 --> CPSAT

    style UI fill:#f5f5f5,stroke:#333,stroke-width:2px
    style APP fill:#e8e8e8,stroke:#333,stroke-width:2px
    style OPT fill:#d9d9d9,stroke:#333,stroke-width:2px
    style OPTCLASS fill:#ccc,stroke:#333,stroke-width:1px
    style DATA fill:#f5f5f5,stroke:#333,stroke-width:2px
```

---

## Gambar 3.6: Matriks Pengumpulan Data

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph DCM["MATRIKS PENGUMPULAN DATA"]
        direction TB

        subgraph STAFF["1. DATA STAF"]
            ST1["ID staf<br/>identifier unik"]
            ST2["Nama"]
            ST3["Posisi atau<br/>jabatan"]
            ST4["Tipe staf<br/>Tetap/Kontrak/Paruh"]
            ST5["Grup kerja"]
            ST6["Preferensi shift"]
        end

        subgraph CONST["2. DATA CONSTRAINT"]
            C1["Aturan kalender<br/>hari libur"]
            C2["Batas harian<br/>min/max libur"]
            C3["Batas bulanan"]
            C4["Konfigurasi<br/>grup staf"]
            C5["Batas per<br/>tipe staf"]
            C6["Aturan prioritas"]
        end

        subgraph HIST["3. JADWAL HISTORIS"]
            H1["Data jadwal<br/>periode sebelumnya"]
            H2["Pola distribusi<br/>hari libur"]
            H3["Pola konflik"]
            H4["Umpan balik<br/>dan keluhan"]
        end
    end

    STAFF --> CONST
    CONST --> HIST

    style DCM fill:#f5f5f5,stroke:#333,stroke-width:2px
    style STAFF fill:#e8e8e8,stroke:#333,stroke-width:1px
    style CONST fill:#d9d9d9,stroke:#333,stroke-width:1px
    style HIST fill:#ccc,stroke:#333,stroke-width:1px
```

---

## Gambar 3.7: Flowchart Proses Optimisasi

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TD
    START(["MULAI"])
    INPUT["Input: Staf, Tanggal,<br/>Constraint, Pre-filled"]
    INIT["Inisialisasi Model<br/>CP-SAT"]
    VAR["Buat Variabel<br/>Keputusan"]

    subgraph CONSTRAINTS["TAMBAH CONSTRAINT"]
        direction LR
        subgraph HARD["HARD"]
            HC1["Satu shift<br/>per hari"]
            HC2["Pre-filled"]
            HC3["Aturan<br/>kalender"]
        end
        subgraph SOFT["SOFT"]
            SC1["Grup staf"]
            SC2["Batas<br/>harian"]
            SC3["Batas<br/>bulanan"]
            SC4["Istirahat<br/>5-hari"]
            SC5["Berdekatan"]
        end
    end

    VIOLATION["Buat Variabel<br/>Pelanggaran"]
    OBJ["Bangun Fungsi Objektif<br/>Minimasi penalti"]
    CONFIG["Konfigurasi Solver<br/>timeout=30s, workers=4"]
    EXEC["Eksekusi Solver<br/>CP-SAT"]
    CHECK{"Status?"}

    OPTIMAL["OPTIMAL"]
    FEASIBLE["FEASIBLE"]
    INFEASIBLE["INFEASIBLE"]

    EXTRACT["Ekstrak Solusi"]
    ERROR["Kembalikan<br/>Error"]

    RESULT["Kembalikan Hasil:<br/>Matriks jadwal,<br/>Pelanggaran,<br/>Statistik"]

    ENDNODE(["SELESAI"])

    START --> INPUT
    INPUT --> INIT
    INIT --> VAR
    VAR --> CONSTRAINTS
    HARD --> VIOLATION
    SOFT --> VIOLATION
    VIOLATION --> OBJ
    OBJ --> CONFIG
    CONFIG --> EXEC
    EXEC --> CHECK

    CHECK -->|"OPTIMAL"| OPTIMAL
    CHECK -->|"FEASIBLE"| FEASIBLE
    CHECK -->|"INFEASIBLE"| INFEASIBLE

    OPTIMAL --> EXTRACT
    FEASIBLE --> EXTRACT
    INFEASIBLE --> ERROR

    EXTRACT --> RESULT
    RESULT --> ENDNODE
    ERROR --> ENDNODE

    style START fill:#333,stroke:#333,color:#fff
    style ENDNODE fill:#333,stroke:#333,color:#fff
    style CONSTRAINTS fill:#e8e8e8,stroke:#333,stroke-width:2px
    style HARD fill:#d9d9d9,stroke:#333,stroke-width:1px
    style SOFT fill:#ccc,stroke:#333,stroke-width:1px
    style CHECK fill:#f5f5f5,stroke:#333,stroke-width:2px
    style OPTIMAL fill:#d9d9d9,stroke:#333,stroke-width:1px
    style FEASIBLE fill:#e0e0e0,stroke:#333,stroke-width:1px
    style INFEASIBLE fill:#999,stroke:#333,color:#fff
    style ERROR fill:#666,stroke:#333,color:#fff
```

---

## Gambar 3.8: Piramida Strategi Pengujian

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#f5f5f5', 'primaryTextColor': '#333', 'primaryBorderColor': '#333', 'lineColor': '#333'}}}%%
flowchart TB
    subgraph PYRAMID["PIRAMIDA STRATEGI PENGUJIAN"]
        direction TB

        E2E["Pengujian E2E<br/>Otomasi browser<br/>Paling sedikit"]
        INT["Pengujian Integrasi<br/>API + Solver<br/>Cakupan sedang"]
        UNIT["Pengujian Unit<br/>Fungsi constraint<br/>Paling banyak"]
    end

    E2E --> INT
    INT --> UNIT

    style E2E fill:#333,stroke:#333,color:#fff
    style INT fill:#808080,stroke:#333,color:#fff
    style UNIT fill:#ccc,stroke:#333,color:#000
```

---

## Bonus: Gantt Chart - Jadwal Penelitian

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#333', 'primaryTextColor': '#333', 'primaryBorderColor': '#333'}}}%%
gantt
    title Jadwal Penelitian
    dateFormat  YYYY-MM-DD

    section Fase 1
    Studi literatur dan analisis kebutuhan    :f1, 2024-01-01, 4w

    section Fase 2
    Desain model CSP dan pemetaan constraint   :f2, after f1, 3w

    section Fase 3
    Implementasi pengoptimal OR-Tools         :f3, after f2, 4w

    section Fase 4
    Integrasi dengan UI dan pengujian           :f4, after f3, 3w

    section Fase 5
    Evaluasi dan analisis hasil               :f5, after f4, 2w

    section Fase 6
    Penulisan laporan dan revisi              :f6, after f5, 4w
```

---

## Cara Menggunakan

1. Buka **https://mermaid.live/**
2. Copy salah satu kode diagram di atas (termasuk bagian `%%{init:...}%%` untuk tema monokrom)
3. Paste di editor sebelah kiri
4. Diagram akan muncul di sebelah kanan
5. Klik **Actions** → **Export PNG** atau **Export SVG** untuk download

### Tips Export:
- **PNG**: Cocok untuk dokumen Word/PDF
- **SVG**: Cocok untuk web dan bisa di-zoom tanpa blur
- **PDF**: Cocok untuk presentasi

---

## Konfigurasi Tema (Monokrom)

Semua diagram menggunakan konfigurasi tema monokrom:

```
%%{init: {'theme': 'base', 'themeVariables': {
    'primaryColor': '#f5f5f5',
    'primaryTextColor': '#333',
    'primaryBorderColor': '#333',
    'lineColor': '#333',
    'secondaryColor': '#e0e0e0',
    'tertiaryColor': '#fff'
}}}%%
```

Warna yang digunakan:
- `#333` - Hitam/gelap (border, teks)
- `#4a4a4a` - Abu-abu tua
- `#666` - Abu-abu sedang gelap
- `#808080` - Abu-abu sedang
- `#999` - Abu-abu
- `#b3b3b3` - Abu-abu muda
- `#ccc` - Abu-abu terang
- `#d9d9d9` - Abu-abu sangat terang
- `#e0e0e0` - Hampir putih
- `#e8e8e8` - Hampir putih
- `#f0f0f0` - Hampir putih
- `#f5f5f5` - Putih keabu-abuan
- `#fff` - Putih
