import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { DrawioFactory } from './widget';

/**
 * File type configuration for Draw.io diagrams
 */
const FILE_TYPE = {
  name: 'drawio',
  displayName: 'Draw.io Diagram',
  extensions: ['.drawio', '.dio'],
  mimeTypes: ['application/vnd.jgraph.mxfile', 'application/xml']
};

/**
 * Initialization data for the jupyterlab_drawio_render_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'jupyterlab_drawio_render_extension:plugin',
  description:
    'JupyterLab extension to render Draw.io diagrams (read-only viewer)',
  autoStart: true,
  activate: (app: JupyterFrontEnd) => {
    console.log(
      'JupyterLab extension jupyterlab_drawio_render_extension is activated!'
    );

    const { docRegistry } = app;

    // Register file type
    docRegistry.addFileType({
      name: FILE_TYPE.name,
      displayName: FILE_TYPE.displayName,
      extensions: FILE_TYPE.extensions,
      mimeTypes: FILE_TYPE.mimeTypes
    });

    console.log(`Registered file type: ${FILE_TYPE.name}`);

    // Create and register widget factory
    const factory = new DrawioFactory({
      name: 'Draw.io Viewer',
      modelName: 'text',
      fileTypes: [FILE_TYPE.name],
      defaultFor: [FILE_TYPE.name],
      readOnly: true
    });

    docRegistry.addWidgetFactory(factory);

    console.log('Draw.io viewer widget factory registered');
  }
};

export default plugin;
