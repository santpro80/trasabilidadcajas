import codecs
import sys

file_path = r"c:\Users\Tecnica\appweb santi\TRAZABILIDAD DE CAJAS\public\pedidos-internos\menu.html"
with codecs.open(file_path, 'r', 'utf-8') as f:
    content = f.read()

# Header and top part
part1_find = """            <!-- Contenido de Menú Principal HTML (oculto hasta cargar JS) -->
            <div id="dashboard-content" class="hidden">
                <header class="flex items-center gap-4 mb-6 border-b border-slate-200 dark:border-white/10 pb-4">
                    <button
                        onclick="document.getElementById('side-drawer').classList.remove('-translate-x-full'); document.getElementById('side-drawer-overlay').classList.remove('hidden');"
                        class="p-2 bg-slate-100 dark:bg-white/5 rounded-xl text-slate-600 dark:text-white">
                        <span class="material-symbols-outlined text-[20px]">menu</span>
                    </button>
                    <span class="font-black tracking-tighter uppercase text-slate-800 dark:text-white">Pedidos</span>
                </header>

                <div class="max-w-5xl mx-auto pb-32">
                    <h1 class="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Panel
                        Principal</h1>
                    <p id="dashboard-subtitle"
                        class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold mb-10">
                        Pedidos Internos - Cargando...</p>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">"""

part1_replace = """            <header class="bg-[#f8fafc] dark:bg-transparent backdrop-blur-md shadow-sm dark:shadow-none border-b border-white/20 dark:border-white/10 px-4 lg:px-8 py-3 flex items-center justify-between gap-4 sticky top-0 z-40 shrink-0 w-full hover:bg-white/95 transition-colors">
                <div class="header-left flex items-center gap-4">
                    <button
                        onclick="document.getElementById('side-drawer').classList.remove('-translate-x-full'); document.getElementById('side-drawer-overlay').classList.remove('hidden');"
                        class="p-2 rounded-xl text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block">
                        <span class="material-symbols-outlined text-[20px]">menu</span>
                    </button>
                    <span class="font-black tracking-tighter uppercase text-villalba-blue dark:text-white mt-1">Pedidos</span>
                </div>
            </header>

            <!-- Contenido de Menú Principal HTML (oculto hasta cargar JS) -->
            <div id="dashboard-content" class="hidden px-4 lg:px-8 py-8 lg:py-12 flex-1 w-full flex-col">
                <div class="max-w-5xl w-full mx-auto">
                    <div class="bg-white dark:bg-transparent dark:border dark:border-white/5 shadow-sm dark:shadow-none rounded-[2rem] p-6 lg:p-10 w-full mb-10">
                        <div class="mb-8 lg:mb-10 text-left">
                            <h1 class="text-3xl lg:text-4xl font-black text-villalba-blue dark:text-white tracking-tight mb-2">
                                Panel Principal</h1>
                            <p id="dashboard-subtitle" class="text-sm tracking-widest uppercase text-slate-500 dark:text-slate-400 font-bold mb-0">
                                Pedidos Internos - Cargando...</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">"""

if part1_find not in content:
    print("Part 1 not found! Let me try matching by split.")
    exit(1)

content = content.replace(part1_find, part1_replace)

# Footer part
part2_find = """</div>
                    </div>
                </div>
            </div>

        </main>"""

part2_replace = """</div>
                        </div>
                    </div>
                </div>
            </div>

        </main>"""

content = content.replace(part2_find, part2_replace)

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(content)
print("Updated exactly!")
