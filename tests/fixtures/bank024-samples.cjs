const samples = structuredClone(require('./bank023-samples.cjs'));

samples[0].prompt = 'По графику зависимости скорости от времени определите путь тележки за первые 6 с.';
samples[4].diagram[2].x2 = 375;
samples[4].diagram[3].x2 = 112;
samples[5].prompt = samples[5].prompt.replace(' Используйте все три строки измерений.', '');
Object.assign(samples[6].graph, { ymin: 10, ymax: 50, step: 2 });
samples[11].prompt = 'Даны первые члены арифметической прогрессии 4, 7, 10. Найдите шестой член.';
samples[12].prompt = 'Масса воды равна 250 г, а её объём составляет 250 см³. Выразите обе величины в СИ.';

module.exports = samples;
