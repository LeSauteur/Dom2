from pathlib import Path
import sys


ROLE_PREFIXES = (
    "- button ",
    "- link ",
    "- textbox ",
    "- spinbutton ",
    "- combobox ",
    "- checkbox ",
    "- radio ",
    "- group ",
)


for argument in sys.argv[1:]:
    path = Path(argument)
    print(f"\n### {path.name}")
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith(ROLE_PREFIXES):
            print(line.strip())
