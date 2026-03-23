import ast, sys

for fname in ["calcolatore_cicli.py", "calcolatore_cicli_gui.py", "calcolatore_cicli_final.py"]:
    try:
        src = open(fname, encoding='utf-8-sig').read()
        ast.parse(src)
        print(f"{fname}: OK ({len(src.splitlines())} lines)")
    except SyntaxError as e:
        print(f"{fname}: SYNTAX ERROR line {e.lineno}: {e.msg}")
    except FileNotFoundError:
        print(f"{fname}: not found")
