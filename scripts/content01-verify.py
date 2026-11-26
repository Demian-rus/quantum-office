"""Independent arithmetic and output checks for CONTENT-01."""
import json
import re
import sys
from fractions import Fraction as F
from math import isqrt
from pathlib import Path

import fitz


def root(value):
    return F(isqrt(value.numerator), isqrt(value.denominator))


def number(text):
    return F(text.replace("−", "-").replace(",", ".").split()[0])


def answers():
    path = 3 * 4 + 2 * F(1, 2) * 3
    sliding_acceleration = F(20, 4) - F(1, 4) * 10
    friction_work = -F(3, 4) * (8 - 4) * (8 + 4)
    lever_force = 18 * F(40, 30)
    expansion_work = (3 - 1) * 3 * 100
    enclosed_area = (3 - 1) * (3 - 1) * 100
    Lorentz_mN = F(4, 1000) * 2 * 10**4 * F(1, 4)
    parallel_and_series = F(12 * 6, 12 + 6) + 3
    image_distance = F(36 * 12, 36 - 12)
    flux_change = 12
    daughter_neutrons = (222 - 86) - 2
    max_cart_speed = root(F(4, 5)**2 + F(80, 1) / F(1, 5) * F(3, 100)**2)
    mixed_temperature = (F(3, 10) * 40 - F(1, 10) * 80) / F(4, 10)
    max_coil_mA = root(F(18)**2 + F(25, 4) * F(96, 10)**2)
    spring_travel = root(F(6) * F(1, 4) * 10 * F(4, 5) / 300)
    target_pressure_Pa = 100000 + F(2, 3) * 900 / F(6, 1000)
    gas_heat = 900 + F(5, 2) * target_pressure_Pa * F(3, 1000)
    resistor_heat = F(3, 10) * F(12, 6)**2 * F(1, 2) * F(4, 6)
    radiation_uW = (F(16, 10**9) / F(16, 10**20)) * 5 * F(66, 10**35) * 6 * 10**14 / F(8, 1000) * 10**6
    return [
        path, sliding_acceleration, friction_work, lever_force,
        [i for i, value in enumerate([False, 2 * 4 / 2 == 4, False, True, 4 + 16 == 10], 1) if value],
        [2, 1], [1, 2], 300 * F(325, 250), 100 * (1 - F(780, 1200)),
        100 * F(14, 28),
        [i for i, value in enumerate([False, expansion_work == 600, False, enclosed_area == 400, False], 1) if value],
        [3, 1], Lorentz_mN, parallel_and_series, image_distance,
        [i for i, value in enumerate([flux_change / 2 == 6, False, flux_change == 6, False, flux_change == 2 * 6], 1) if value],
        [1, 2], [3, 1], daughter_neutrons, 100 * (1 - F(1, 2)**2), [1, 3],
        (F(248 + 252, 2), F(252 - 248, 2)), [1, 4],
        [i for i, value in enumerate([False, 2**2 == 4, False, 4 / 2**2 == 1, F(1, 16) == F(1, 2)], 1) if value],
        max_cart_speed, mixed_temperature, max_coil_mA,
        "После охлаждения давление ниже, чем сразу после сжатия, и выше начального.",
        spring_travel, gas_heat, resistor_heat, radiation_uW,
    ]


def check_pdfs(folder):
    formats = {
        "student-portrait": (False, False), "student-landscape": (True, False),
        "brief-key": (False, False), "solutions-and-rubrics": (False, True),
        "tasks-and-solutions": (False, True),
    }
    for name, (landscape, with_rubrics) in formats.items():
        with fitz.open(folder / f"{name}.pdf") as pdf:
            nominal = (841.89, 595.28) if landscape else (595.28, 841.89)
            text = "\n".join(page.get_text() for page in pdf)
            assert text.count("Физика — авторский вариант № 1 по модели ЕГЭ-2019") == 1, name
            assert "Квант Икс" in text, name
            assert text.count("Критерии оценивания") == (32 if with_rubrics else 0), name
            if name.startswith("student-"):
                assert text.count("Часть 1") == text.count("Часть 2") == 1, name
                assert not re.search(r"^Решение$", text, re.M), name
                assert text.count("Ответ:") == 27, name
            assert all(not page.get_images() for page in pdf), name
            for page in pdf:
                assert abs(page.rect.width - nominal[0]) < .6 and abs(page.rect.height - nominal[1]) < .6
                assert all(.0 <= item[0] <= item[2] <= page.rect.width+.1 and .0 <= item[1] <= item[3] <= page.rect.height+.1 for item in page.get_text("words")), name
            print(f"{name}: {len(pdf)} A4 pages, selectable text, no raster figures")


def main(folder):
    work = json.loads((folder / "physics-ege-2019-variant-1.qwork").read_text(encoding="utf-8"))
    bank = json.loads((folder / "physics-ege-2019-variant-1.qwbank").read_text(encoding="utf-8"))
    assert len(work["tasks"]) == len(bank["items"]) == 32
    for slot, (task, record, expected) in enumerate(zip(work["tasks"], bank["items"], answers()), 1):
        actual = task["answer"]
        if isinstance(expected, list):
            assert [int(digit) for digit in actual] == expected, slot
        elif isinstance(expected, tuple):
            assert tuple(number(part.strip()) for part in actual.split("±")) == expected, slot
        elif isinstance(expected, str):
            assert actual == expected, slot
        else:
            assert number(actual) == expected, (slot, actual, expected)
        assert record["task"]["answer"] == actual and record["slot"] == str(slot)
        assert record["bankNumber"] == 0 and record["year"] == ""
        print(f"{slot:02}: {actual}")
    assert sum(task["points"] for task in work["tasks"]) == 52
    check_pdfs(folder)
    print("PASS independent answer check and actual PDF files")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
