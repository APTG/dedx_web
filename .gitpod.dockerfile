FROM gitpod/workspace-full

RUN git clone https://github.com/emscripten-core/emsdk.git $HOME/emsdk
RUN cd $HOME/emsdk && ./emsdk install latest && ./emsdk activate latest