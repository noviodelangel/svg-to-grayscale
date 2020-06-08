# Usage

Create `svg` directory and place your svg files in there.

Install dependencies with `npm install`

Execute command `npm start <input_dir> <output_dir> <primary_color> <tolerance>`.

Arguments:

| argument               | value                                                                  | default value      |
|----------------------- | ---------------------------------------------------------------------- | ------------------ |
| <input_dir>            | directory with source svg                                              | svg                |
| <output_dir>           | directory to place converted svg (perserves the folder structure)      | out                |
| <primary_color>        | primary color used as colorize base (eg. `"#AC45DF"`)                  | #00ACC1            |
| <tolerance>            | range relative to primary color lightness to which svg will be scalled | 0.2                |

Your result files are in `out` directory.
