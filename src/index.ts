import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import { DrawioFactory } from './widget';

/**
 * Extensions we handle
 */
const DRAWIO_EXTENSIONS = ['.drawio', '.dio'];

/**
 * Default file type name
 */
const DEFAULT_FILE_TYPE = 'drawio';

/**
 * Find existing file type that handles .drawio extension
 */
function findDrawioFileType(docRegistry: any): string | null {
  // Check common file type names first (including vscode-icons extension)
  const commonNames = [
    'vscode-drawio',
    'drawio',
    'Drawio',
    'DrawIO',
    'diagram'
  ];
  for (const name of commonNames) {
    const ft = docRegistry.getFileType(name);
    if (ft) {
      return name;
    }
  }

  // Search all file types for one handling .drawio
  const fileTypes = docRegistry.fileTypes();
  for (const ft of fileTypes) {
    const extensions = ft.extensions || [];
    if (extensions.some((ext: string) => DRAWIO_EXTENSIONS.includes(ext))) {
      return ft.name;
    }
  }

  return null;
}

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

    // Find existing file type for .drawio
    let fileTypeName = findDrawioFileType(docRegistry);

    if (!fileTypeName) {
      // Register minimal file type only if absolutely none exists
      // Don't set icon - let vscode-icons or other extensions handle it
      fileTypeName = DEFAULT_FILE_TYPE;
      docRegistry.addFileType({
        name: fileTypeName,
        displayName: 'Draw.io Diagram',
        extensions: DRAWIO_EXTENSIONS,
        mimeTypes: ['application/vnd.jgraph.mxfile']
      });
      console.log(`Registered file type: ${fileTypeName}`);
    } else {
      console.log(
        `Using existing file type '${fileTypeName}' for Draw.io diagrams`
      );
    }

    // Create and register widget factory
    const factory = new DrawioFactory({
      name: 'Draw.io Viewer',
      modelName: 'text',
      fileTypes: [fileTypeName],
      defaultFor: [fileTypeName],
      readOnly: true
    });

    docRegistry.addWidgetFactory(factory);

    console.log('Draw.io viewer widget factory registered');
  }
};

export default plugin;
