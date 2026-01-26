import 'leaflet';

declare module 'leaflet' {
    namespace Control {
        class Draw extends Control {
            constructor(options?: any);
        }
    }

    namespace Draw {
        const Event: any;
    }
}