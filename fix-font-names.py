"""把 SemiBold 实例的名称表改正确（fontTools 的 instancer 找不到 wght=600 这个命名实例，名称表留着默认值）。"""
from fontTools.ttLib import TTFont

FAM, SUB = 'Noto Sans SC SemiBold', 'Regular'
FULL, PS = FAM, 'NotoSansSC-SemiBold'
p = '_fonts/NotoSansSC-SemiBold.ttf'
t = TTFont(p)
n = t['name']
for nid, val in ((1, FAM), (2, SUB), (3, FULL + ';1.000'), (4, FULL), (6, PS), (16, FAM), (17, SUB)):
    for rec in list(n.names):
        if rec.nameID == nid:
            n.names.remove(rec)
    n.setName(val, nid, 3, 1, 0x409)
    n.setName(val, nid, 1, 0, 0)
t['OS/2'].usWeightClass = 600
t.save(p)
t2 = TTFont(p, lazy=True)
g = lambda i: str(t2['name'].getName(i, 3, 1, 0x409) or t2['name'].getName(i, 1, 0, 0))
print('已改名:', g(1), '|', g(2), '|', g(6), '| wght', t2['OS/2'].usWeightClass)
