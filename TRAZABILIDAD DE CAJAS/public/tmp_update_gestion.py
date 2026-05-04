import codecs
import re

file_path = r"c:\Users\Tecnica\appweb santi\TRAZABILIDAD DE CAJAS\public\pedidos-internos\gestion-pedidos.html"
with codecs.open(file_path, 'r', 'utf-8') as f:
    html = f.read()

# 1. Update body wrapper background to use the new gradient
html = re.sub(
    r'<body\s+class="bg-\[#f8fafc\] dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors duration-300">',
    r'<body class="bg-gradient-to-br from-[#6e8efb] to-[#a777e3] dark:from-[#0a0f16] dark:to-[#0a0f16] text-slate-900 dark:text-[#f1f5f9] antialiased font-sans transition-colors duration-300">',
    html
)

# Replace the inner min-h-screen container bg
html = html.replace(
    '<div class="flex flex-col min-h-screen bg-[#f8fafc] dark:bg-background-dark">',
    '<div class="flex flex-col min-h-screen bg-transparent">'
)

# 2. Update Header
header_start = """          <header
            class="sticky top-0 z-50 bg-white dark:bg-background-dark border-b border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between px-6 py-4">
              <div class="flex items-center gap-3">
                <button
                  onclick="document.getElementById('side-drawer').classList.remove('-translate-x-full'); document.getElementById('side-drawer-overlay').classList.remove('hidden');"
                  class="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ">
                  <span class="material-symbols-outlined text-slate-600 dark:text-slate-400">menu</span>
                </button>
                <button onclick="window.location.href='menu.html'"
                  class="size-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors ml-[-4px]">
                  <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div
                  class="size-8 rounded-xl bg-gradient-to-br from-villalba-blue to-blue-800 flex items-center justify-center text-white font-black text-sm shadow-lg shadow-blue-500/30">
                  <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                </div>
                <h1 class="text-xl font-bold tracking-tight uppercase text-slate-900 dark:text-white mt-1">Gestin de
                  Pedidos
                </h1>
              </div>
              <div class="flex flex-col items-end">
                <span id="my-orders-count"
                  class="text-[10px] font-black text-villalba-blue uppercase tracking-widest">...</span>
              </div>
            </div>
          </header>"""

new_header = """          <header class="bg-[#f8fafc] dark:bg-transparent backdrop-blur-md shadow-sm dark:shadow-none border-b border-white/20 dark:border-white/10 px-4 lg:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-40 shrink-0 w-full hover:bg-white/95 transition-colors">
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
          </header>"""

# Add fixing encoding for Gestin
html = html.replace(header_start, new_header)


# 3. Update the Tabs bar to look better on blue
tabs_old = """            <!-- Status Tabs -->
            <div class="flex gap-2 bg-slate-100 dark:bg-surface-dark border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl mb-8 overflow-x-auto snap-x hide-scrollbar">"""

tabs_new = """            <!-- Status Tabs -->
            <div class="flex gap-2 bg-white/20 dark:bg-surface-dark border border-white/20 dark:border-slate-800 p-1.5 rounded-2xl mb-8 overflow-x-auto snap-x hide-scrollbar backdrop-blur-sm shadow-sm">"""
html = html.replace(tabs_old, tabs_new)

# 4. Remove kanban lane bg-slate-50
html = html.replace('<div class="flex flex-col bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-4 border border-slate-100 dark:border-white/5 shadow-inner">',
                    '<div class="flex flex-col">')


# 5. Search Bar update
html = html.replace('class="w-full pl-12 pr-4 h-14 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl text-base outline-none focus:ring-2 focus:ring-villalba-blue/50 transition-all font-bold text-slate-900 dark:text-white"',
                    'class="w-full pl-12 pr-4 h-14 bg-white/90 dark:bg-surface-dark border-0 shadow-sm rounded-xl text-base outline-none focus:ring-2 focus:ring-villalba-blue/50 transition-all font-bold text-slate-900 dark:text-white"')

html = html.replace('class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search',
                    'class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search')


with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(html)
print("Updated gestion-pedidos.html theme.")
