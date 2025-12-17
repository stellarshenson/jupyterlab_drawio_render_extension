declare module 'mxgraph' {
  interface mxGraphExportObject {
    mxGraph: any;
    mxCodec: any;
    mxUtils: any;
    mxEvent: any;
    mxClient: any;
    mxRubberband: any;
    mxConstants: any;
    [key: string]: any;
  }

  interface mxGraphOptions {
    mxBasePath?: string;
    mxImageBasePath?: string;
    mxLoadResources?: boolean;
    mxLoadStylesheets?: boolean;
  }

  function mxgraph(options?: mxGraphOptions): mxGraphExportObject;
  export = mxgraph;
}
