"""Read grid, markers and connecting segment in one PDF coordinate system."""
import pymupdf


def verify_ab(page, region, graph, measured_points):
    drawings = [p for p in page.get_drawings() if region.contains(p['rect'])]
    # Derive the plot transform independently from its actual grid strokes.
    grid = [p for p in drawings if p['color'] is not None and
            max(abs(a-b) for a, b in zip(p['color'], (217/255, 222/255, 228/255))) < .001]
    assert grid, 'actual PDF grid is missing'
    plot = pymupdf.Rect(min(p['rect'].x0 for p in grid), min(p['rect'].y0 for p in grid),
                       max(p['rect'].x1 for p in grid), max(p['rect'].y1 for p in grid))
    assert abs(plot.width / plot.height - 369/216) < .001, 'PDF plot aspect ratio changed'
    assert abs(plot.width - 48*72/25.4) < .03, 'PDF plot must remain 48 mm wide'
    expected = [pymupdf.Point(plot.x0 + (p['x']-graph['xmin'])/(graph['xmax']-graph['xmin'])*plot.width,
                            plot.y1 - (p['y']-graph['ymin'])/(graph['ymax']-graph['ymin'])*plot.height)
                for p in graph['points']]
    assert len(expected) == len(measured_points) == 2
    # Filled circular Bezier paths are independent of the AB stroke.
    markers = [(p['rect'].tl+p['rect'].br)/2 for p in drawings
               if p['type'] == 'f' and p['items'] and all(i[0] == 'c' for i in p['items'])
               and abs(p['rect'].width-p['rect'].height) < .01
               and abs(p['rect'].width - 7*plot.width/369) < .01]
    assert len(markers) == 2, 'actual A/B point markers are missing'
    points = []
    for e in expected:
        matches = [p for p in markers if abs(p-e) < .03]
        assert len(matches) == 1, 'PDF marker must agree with QWORK coordinates and actual grid'
        points.append(matches[0])
    a, b = points
    # Preview and print paint origins may differ by CSS-pixel snapping. Their
    # vectors must still agree; do not use preview origins to locate PDF paths.
    preview = [pymupdf.Point(p['x'], p['y']) for p in measured_points]
    assert abs((preview[1]-preview[0])-(b-a)) < .03, 'preview/PDF AB scale or direction differs'
    segments = []
    for p in drawings:
        for item in p['items']:
            if item[0] == 'l' and ((abs(item[1]-a) < .3 and abs(item[2]-b) < .3) or
                                   (abs(item[2]-a) < .3 and abs(item[1]-b) < .3)):
                segments.append((item[1], item[2], p['width']))
    assert segments, 'actual AB vector path must agree with PDF markers and QWORK positions'
    return points, segments, {'plotPt': list(plot), 'expectedPointsPt': [list(p) for p in expected],
                              'previewToPdfOriginPt': list(a-preview[0])}
