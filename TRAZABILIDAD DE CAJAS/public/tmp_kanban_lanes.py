import codecs
import re

file_path = r"c:\Users\Tecnica\appweb santi\TRAZABILIDAD DE CAJAS\public\pedidos-internos\mis-pedidos.html"

with codecs.open(file_path, 'r', 'utf-8') as f:
    html = f.read()

# Replace <div class="flex flex-col"> right after <!-- High | Medium | Low Priority -->
# We have to be careful not to replace it everywhere.
html = html.replace('<!-- High Priority -->\n              <div class="flex flex-col">', 
                    '<!-- High Priority -->\n              <div class="flex flex-col bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-4 border border-slate-100 dark:border-white/5 shadow-inner">')

html = html.replace('<!-- Medium Priority -->\n              <div class="flex flex-col">', 
                    '<!-- Medium Priority -->\n              <div class="flex flex-col bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-4 border border-slate-100 dark:border-white/5 shadow-inner">')

html = html.replace('<!-- Low Priority -->\n              <div class="flex flex-col">', 
                    '<!-- Low Priority -->\n              <div class="flex flex-col bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-4 border border-slate-100 dark:border-white/5 shadow-inner">')

# Also, since we added padding (p-4) to the columns, the gap-6 on the grid might be a bit tight, let's change to gap-8
html = html.replace('<div class="grid grid-cols-1 md:grid-cols-3 gap-6">', 
                    '<div class="grid grid-cols-1 md:grid-cols-3 gap-8">')

with codecs.open(file_path, 'w', 'utf-8') as f:
    f.write(html)

print("Updated Kanban lanes in mis-pedidos.html!")
