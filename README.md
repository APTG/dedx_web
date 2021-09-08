# dEdx Web
### temp Readme

An online interface of the dEdx library.
## Live-dev version
Development version available at https://aptg.github.io/web_dev/

## General idea
The idea of this project is to prepare a web interface of the dEdx library. Thanks to WebAssembly technology as well as clean and simple UI it will allow users to calculate and view stopping powers and energies of various particles.

Part of the project is similar to the PSTAR program of the National Institue of Standards and Technology, but we aim to add more options to the queries, make the plots dynamicly generated, create a fluent user interface and - by focusing on responsivenes of the web layout - enable researchers from around the world to gather the necessery data on their mobile phones in lab enviroment.

## Related projects
- PSTAR project https://physics.nist.gov/PhysRefData/Star/Text/PSTAR.html
- ATIMA project https://www.isotopea.com/webatima/

## Technologies used in the project
The project uses 3 key technologies:
- React.js - frontend development framework
- JSROOT - a ploting library
- WebAssembly - allows to transfer the dEdx library into web application

As to the choice of the plotting library, we had many options but ultimately we decided that JSROOT fits the expectations of future users the best. More on that in the Further documentation section

## Key functionalities
One of the main assets of our application is the abilty to plot graphs of stopping power and energy for multiple particles on one canvas. Using the JSROOT graphing library all the plots will be dynamic, easy to scale and adjust in the way user needs it.

## Team and Supervisor
Developed by Piotr Połeć and Marek Ślązak under supervision of Leszek Granka 

## Further documentation
Further documentation can be found in the link below:

TODO: insert link to documentation