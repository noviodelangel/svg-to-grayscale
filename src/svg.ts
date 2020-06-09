import * as grunt from 'grunt';
import * as path from 'path';
import * as SVG from '@svgdotjs/svg.js';
import {Color} from "@svgdotjs/svg.js";
import {Boundaries} from "./Boundaries";

// default config
let config = {
    inputFolder: 'svg',
    outputFolder: 'out',
    primaryColor: '#00acc1',
    tolerance: 0.2,
}

// override default config
if (process.argv[2]) {
    config.inputFolder = process.argv[2];
}
if (process.argv[3]) {
    config.outputFolder = process.argv[3];
}
if (process.argv[4]) {
    config.primaryColor = process.argv[4];
}
if (process.argv[5]) {
    config.tolerance = Number(process.argv[5]);
}

// in case paths are relative
config.inputFolder = path.resolve(config.inputFolder);
config.outputFolder = path.resolve(config.outputFolder);

const sources = grunt.file.expand(`${config.inputFolder}/**/*.svg`);
const namedColors: Array<string> = grunt.file.read('named-colors.txt').split('\n');
const colorizeColor: Color = new SVG.Color(config.primaryColor).hsl();
const selectedNamedColors: Map<string, string> = new Map([
    ['currentColor', colorizeColor.rgb().toHex()],
    ['black', '#000000'],
    ['gold', '#FFD700'],
    ['gray', '#808080'],
    ['green', '#008000'],
    ['orange', '#FFA500'],
    ['purple', '#800080'],
    ['red', '#FF0000'],
    ['silver', '#C0C0C0'],
    ['white', '#FFFFFF'],
]);

const COLOR_COUNT = 255;
const MAX_LIGHTNESS_VALUE = 100;
const colorLightnessBase: Array<number> = [];
Array.from(Array(COLOR_COUNT + 1).keys()).forEach((i) => {
    colorLightnessBase.push(i * (MAX_LIGHTNESS_VALUE / COLOR_COUNT));
});

/**
 * Colorizes picture using current colorize color
 * @param color - input color
 * @param fileName - file name for logging purposes (in case we want to know which files contain certain color encodings)
 */
function getColorizedColor(color: string, fileName?: string) {
    if (namedColors.includes(color)) {
        return colorizeNamedColor(color);
    }
    return colorizeRgbString(color);
}

function getColorizedColorWithLightness(colorizeColor: Color, lightness: number) {
    return new SVG.Color(colorizeColor.h, colorizeColor.s, lightness, 'hsl');
}

function getHSLGrayscaleColor(color: string) {
    if (namedColors.includes(color)) {
        return new SVG.Color(toGrayscale(selectedNamedColors.get(color))).hsl();
    }
    return new SVG.Color(toGrayscale(color)).hsl();
}

function toGrayscale(color: string) {
    const svgColor: Color = new SVG.Color(color);
    const grayScale = Math.round((0.3 * svgColor.r) + (0.59 * svgColor.g) + (0.11 * svgColor.b));
    const grayScaleColor: Color = new SVG.Color(grayScale, grayScale, grayScale, 'rgb');
    return grayScaleColor.toHex();
}

function scaleLightness(primaryLightness: number, currentLightness: number, tolerance: number) {
    const lowerLightnessBoundary: number = (1 - tolerance) * primaryLightness;
    const upperLightnessBoundary: number = (1 + tolerance) * primaryLightness;
    if (currentLightness >= lowerLightnessBoundary && currentLightness <= upperLightnessBoundary) {
        return currentLightness;
    }
    if (currentLightness < primaryLightness) {
        return lowerLightnessBoundary;
    }
    if (currentLightness > primaryLightness) {
        return upperLightnessBoundary;
    }
}

function scaleLightnessWithReference(referenceBoundaries: Boundaries, boundaries: Boundaries, color: SVG.Color): number {
    if (boundaries.range == 0) { // if svg has only one color then boundaries point to the same lightness and range is 0 so I just set lightness to primaryColorLightness
        return colorizeColor.l;
    }

    const distance = color.l - boundaries.low;
    return referenceBoundaries.low + (distance / boundaries.range) * referenceBoundaries.range;
}

/**
 * @param inputColor - accepts three based (e.g. #f06), six based (e.g. #ff0066) hex format, RGB function string (e.g. rgb(211,56,51))
 */
function colorizeRgbString(inputColor: string) {
    const color: Color = new SVG.Color(inputColor);
    const lightness: number = scaleLightness(colorizeColor.l, color.hsl().l, config.tolerance);
    const colorizedColor = new SVG.Color(colorizeColor.h, colorizeColor.s, lightness, 'hsl');
    return colorizedColor.toHex();
}

function colorizeNamedColor(color: string) {
    if (!selectedNamedColors.get(color)) {
        console.error(`Unknown color mapping for: ${color}`);
        return color;
    }
    return colorizeRgbString(selectedNamedColors.get(color));
}

function getLightnessBoundariesWithTolerance(color: Color, tolerance: number): Boundaries {
    return new Boundaries((1 - tolerance) * color.l, (1 + tolerance) * color.l);
}

function getLightnessBoundariesFromSortedColorArray(colors: Array<SVG.Color>): Boundaries {
    return new Boundaries(colors[0].l, colors[colors.length - 1].l);
}

function adjustBoundaries(referenceBoundaries: Boundaries, boundaries: Boundaries) {
    boundaries.setLow((boundaries.low < referenceBoundaries.low) ? referenceBoundaries.low : boundaries.low);
    boundaries.setHigh((boundaries.high > referenceBoundaries.high) ? referenceBoundaries.high : boundaries.high);
    return boundaries;
}

function examineSvgColors(match: RegExpExecArray, regExp: RegExp, output: string, hslColorsFromSvg: Array<SVG.Color>) {
    const matches: Array<string> = new Array<string>();
    while (match = regExp.exec(output)) {
        hslColorsFromSvg.push(getHSLGrayscaleColor(match[0]));
        matches.push(match[0]);
    }
    return matches;
}

function calculateBoundaries(hslColorsFromSvg: Array<SVG.Color>, fileName: string) {
    hslColorsFromSvg.sort((a, b) => a.l - b.l);
    const primaryLightnessBoundaries: Boundaries = getLightnessBoundariesWithTolerance(colorizeColor, config.tolerance);
    console.log(`[${fileName}] Reference boundaries: [${primaryLightnessBoundaries.low}, ${primaryLightnessBoundaries.high}]`);
    let svgLightnessBoundaries: Boundaries = getLightnessBoundariesFromSortedColorArray(hslColorsFromSvg);
    console.log(`[${fileName}] SVG boundaries: [${svgLightnessBoundaries.low}, ${svgLightnessBoundaries.high}]`);
    return {primaryLightnessBoundaries, svgLightnessBoundaries};
}

function calculateNormalizedIndex(lightness) {
    return Math.round((lightness / MAX_LIGHTNESS_VALUE) * COLOR_COUNT);
}

function getNormalizedColor(color: SVG.Color) {
    return new SVG.Color(color.h, color.s, colorLightnessBase[calculateNormalizedIndex(color.l)], 'hsl');
}

function generateCssVarName(normalizedColor: SVG.Color) {
    return `--primary-l-${calculateNormalizedIndex(normalizedColor.l)}`;
}

function processImage(output: string, fileName: string) {
    const namedColorsRegExpString = Array.from(selectedNamedColors.keys()).map(word => `\\b${word}\\b`).join('|');
    const regExp: RegExp = new RegExp(`${namedColorsRegExpString}|#[0-9A-F]{3,6}|rgb\\(.*?\\)`, 'gi');
    let match: RegExpExecArray = null;
    const hslColorsFromSvg: Array<SVG.Color> = new Array<SVG.Color>();
    const matches: Array<string> = examineSvgColors(match, regExp, output, hslColorsFromSvg);

    if (matches.length == 0) {
        return output;
    }

    let {primaryLightnessBoundaries, svgLightnessBoundaries} = calculateBoundaries(hslColorsFromSvg, fileName);

    return output.replace(regExp, (match) => {
        const color = getHSLGrayscaleColor(match);
        const scaledLightness = scaleLightnessWithReference(primaryLightnessBoundaries, svgLightnessBoundaries, color);
        const scaledColor: SVG.Color = getColorizedColorWithLightness(colorizeColor, (primaryLightnessBoundaries.contains(svgLightnessBoundaries)) ? color.l : scaledLightness);
        const normalizedColor: SVG.Color = getNormalizedColor(scaledColor);
        console.log(`[${fileName}] changing color=${color.toHex()} with lightness=${color.l} to color=${scaledColor.toHex()} with lightness=${scaledColor.l} then normalized to color=${normalizedColor.toHex()} with lightness=${normalizedColor.l} and normalizedIndex=${calculateNormalizedIndex(normalizedColor.l)}`);
        return `var(${generateCssVarName(normalizedColor)})`;
    });
}

function generateColorMap() {
    let output: string = 'html\n';
    colorLightnessBase.forEach(lightness => {
        const color: SVG.Color = new SVG.Color(colorizeColor.h, colorizeColor.s, lightness, 'hsl');
        output += `\t${generateCssVarName(color)}: ${color.toRgb()}\n`
    });
    return output;
}

function getOutputPath(filePath: string, inputBaseFolder: string, outputBaseFolder: string) {
    return `${outputBaseFolder}${filePath.replace(inputBaseFolder, '')}`;
}

sources.forEach(filePath => {
    const fileName: string = path.basename(filePath);
    const outputPath: string = getOutputPath(filePath, config.inputFolder, config.outputFolder);
    const svgFileContent: string = grunt.file.read(filePath);
    let output: string = svgFileContent;

    output = processImage(output, fileName);

    grunt.file.write(outputPath, output);
});

grunt.file.write(`${config.outputFolder}/color_map.sass`, generateColorMap());