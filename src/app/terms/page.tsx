export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
          <h1 className="text-3xl font-bold text-slate-800 mb-6">Terms & Conditions</h1>
          
          <div className="prose prose-slate max-w-none space-y-4 text-sm text-slate-600">
            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">1. Penerimaan Terms & Conditions</h2>
              <p>
                Dengan mengakses dan menggunakan aplikasi Organisasi Book ("Aplikasi"), Anda setuju untuk terikat oleh Terms & Conditions ini. 
                Jika Anda tidak setuju dengan bagian manapun dari terms ini, Anda tidak boleh menggunakan Aplikasi ini.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">2. Penggunaan Aplikasi</h2>
              <p>
                Aplikasi ini disediakan untuk membantu organisasi dalam mengelola data finansial dan operasional. 
                Anda bertanggung jawab untuk menjaga kerahasiaan akun dan password Anda, serta semua aktivitas yang terjadi di bawah akun Anda.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">3. Data dan Privasi</h2>
              <p>
                Dengan menggunakan Aplikasi, Anda setuju untuk menyimpan data finansial dan operasional organisasi Anda dalam sistem kami.
                Data Anda dilindungi dan digunakan sesuai dengan kebijakan privasi kami. Kami berkomitmen untuk melindungi data Anda 
                dengan standar keamanan yang wajar.
              </p>
              <p className="mt-2">
                Kami berhak mengubah terms & conditions ini tanpa pemberitahuan sebelumnya. Perubahan akan berlaku efektif 
                segera setelah diposting di Aplikasi.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">4. Batasan Tanggung Jawab</h2>
              <p>
                Penggunaan Aplikasi ini adalah risiko Anda sendiri. Aplikasi disediakan "sebagaimana adanya" dan "sebagaimana tersedia" 
                tanpa jaminan dalam bentuk apapun, baik tersurat maupun tersirat.
              </p>
              <p className="mt-2">
                Kami tidak bertanggung jawab atas kerugian langsung atau tidak langsung yang timbul dari penggunaan atau ketidakmampuan 
                menggunakan Aplikasi, termasuk namun tidak terbatas pada kehilangan data, keuntungan, atau kerusakan lainnya.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">5. Kepatuhan Hukum</h2>
              <p>
                Anda setuju untuk menggunakan Aplikasi ini sesuai dengan semua hukum dan peraturan yang berlaku. 
                Anda tidak boleh menggunakan Aplikasi untuk tujuan ilegal atau melanggar hak pihak ketiga.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">6. Perubahan Layanan</h2>
              <p>
                Kami berhak untuk memodifikasi, menghentikan, atau menghentikan sementara Aplikasi atau layanan apa pun di dalamnya 
                kapan saja tanpa pemberitahuan sebelumnya.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">7. Indemnifikasi</h2>
              <p>
                Anda setuju untuk mengganti kerugian, membela, dan membebaskan kami dari klaim, tuntutan, kerugian, dan kerusakan 
                yang timbul dari penggunaan Aplikasi oleh Anda atau pelanggaran Terms & Conditions ini.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-800 mt-6 mb-2">8. Kontak</h2>
              <p>
                Jika Anda memiliki pertanyaan tentang Terms & Conditions ini, silakan hubungi kami melalui email support kami.
              </p>
            </section>

            <section className="border-t border-slate-200 pt-4 mt-8">
              <p className="text-xs text-slate-500">
                Terakhir diperbarui: {new Date().toLocaleDateString("id-ID")}
              </p>
            </section>
          </div>

          <div className="mt-8">
            <a href="/login" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
              ← Kembali ke Login
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
