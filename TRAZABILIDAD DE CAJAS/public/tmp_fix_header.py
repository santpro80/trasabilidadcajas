import codecs

file_path = r"c:\Users\Tecnica\appweb santi\TRAZABILIDAD DE CAJAS\public\pedidos-internos\gestion-pedidos.html"
with codecs.open(file_path, 'r', 'utf-8') as f:
    html = f.read()

# I need to restore:
"""
      <div id="loading-state"
        class="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 mt-20">
        <span class="material-symbols-outlined text-4xl animate-spin text-villalba-blue">sync</span>
      </div>

      <div id="operator-content" class="hidden h-full">
        <div class="flex flex-col min-h-screen bg-transparent">
"""

broken_part = '<main class="flex-1 overflow-y-auto relative p-0" id="main-content">'

fixed_part = """    <main class="flex-1 overflow-y-auto relative p-0" id="main-content">
      <div id="loading-state"
        class="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4 mt-20">
        <span class="material-symbols-outlined text-4xl animate-spin text-villalba-blue">sync</span>
      </div>

      <div id="operator-content" class="hidden h-full">
        <div class="flex flex-col min-h-screen bg-transparent">
          <header class="bg-[#f8fafc] dark:bg-transparent backdrop-blur-md shadow-sm dark:shadow-none border-b border-white/20 dark:border-white/10 px-4 lg:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-40 shrink-0 w-full hover:bg-white/95 transition-colors">
            <div class="flex items-center gap-4">
                <button onclick="document.getElementById('side-drawer').classList.remove('-translate-x-full'); document.getElementById('side-drawer-overlay').classList.remove('hidden');" class="p-2 rounded-xl text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">menu</span>
                </button>
                <button onclick="window.location.href='menu.html'" class="p-2 rounded-xl text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center">
                    <span class="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <div class="size-8 rounded-xl bg-gradient-to-br from-villalba-blue to-blue-800 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/30">
                    <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                </div>
                <h1 class="text-xl font-bold tracking-tighter uppercase text-villalba-blue dark:text-white mt-1">Gestión de Pedidos</h1>
            </div>
            <div class="flex items-center gap-4">
                <span id="my-orders-count" class="text-[10px] font-black text-villalba-blue dark:text-blue-400 uppercase tracking-widest bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">...</span>
            </div>
          </header>

          <div class="flex-1 px-4 lg:px-8 py-8 space-y-6 pb-40 w-full max-w-7xl mx-auto">
            <div class="relative max-w-[480px] mx-auto mb-8">
              <span
                class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>"""

html = html.replace("""    <main class="flex-1 overflow-y-auto relative p-0" id="main-content">
      <div id="loading-state"
              <input id="operator-search"
                class="w-full pl-12 pr-4 h-14 bg-white/90 dark:bg-surface-dark border-0 shadow-sm rounded-xl text-base outline-none focus:ring-2 focus:ring-villalba-blue/50 transition-all font-bold text-slate-900 dark:text-white"
                placeholder="Buscar en mis pedidos..." type="text" />""", fixed_part + """\n              <input id="operator-search"
                class="w-full pl-12 pr-4 h-14 bg-white/90 dark:bg-surface-dark border-0 shadow-sm rounded-xl text-base outline-none focus:ring-2 focus:ring-villalba-blue/50 transition-all font-bold text-slate-900 dark:text-white"
                placeholder="Buscar en mis pedidos..." type="text" />""")


with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(html)
print("Restored header")
