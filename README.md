# dEdx web

An online interface of the libdEdx library.
Stable version of the web interface is available at [aptg.github.io/web](https://aptg.github.io/web/)

## General idea
The idea of this project is to prepare a web interface of the libdEdx library. 
Thanks to WebAssembly technology as well as clean and simple UI it will allow users to calculate and view stopping powers and energies of various particles.

Part of the project is similar to the PSTAR program of the National Institue of Standards and Technology, but we aim to add more options to the queries, make the plots dynamically generated, create a fluent user interface and - by focusing on responsivenes of the web layout - enable researchers from around the world to gather the necessery data on their mobile phones in lab enviroment.

## Documentation

Design documents for the ongoing redesign live in [`docs/`](docs/):

| Document | Description |
|----------|-------------|
| [Redesign Plan](docs/00-redesign-plan.md) | Implementation stages, tech stack, spec template |
| [Project Vision](docs/01-project-vision.md) | Audience, core use cases, design principles |
| [WASM API Contract](docs/06-wasm-api-contract.md) | TypeScript ↔ libdedx WebAssembly interface |
| [Feature Specs](docs/04-feature-specs/) | Per-feature specs (entity selection, calculator, unit handling) |
| [AI Session Logs](docs/ai-logs/) | Detailed AI coding session logs |
| [AI Changelog](CHANGELOG-AI.md) | Summary table of all AI-assisted sessions |

## Related projects
- PSTAR project https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html
- ATIMA project https://www.isotopea.com/webatima/

## Technologies used in the project
The project uses 3 key technologies:
- React.js - frontend development framework
- [JSROOT](https://root.cern.ch/js/) - a ploting library
- WebAssembly - allows to transfer the libdEdx library into web application

As to the choice of the plotting library, we had many options but ultimately we decided that JSROOT fits the expectations of future users the best. 


## Key functionalities
One of the main assets of our application is the abilty to plot graphs of stopping power and energy for multiple particles on one canvas. 
Using the JSROOT graphing library all the plots will be dynamic, easy to scale and adjust in the way user needs it.

## Team and Supervisor
Developed by [Piotr Połeć](https://github.com/piotrpolec) and [Marek Ślązak](https://github.com/Mexolius) under supervision of [Leszek Granka](https://github.com/grzanka)

## Others
Unstable development version, being updated at every commit is available at [aptg.github.io/web_dev](https://aptg.github.io/web_dev/)
