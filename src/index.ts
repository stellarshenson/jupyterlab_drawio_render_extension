import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { LabIcon } from '@jupyterlab/ui-components';

import {
  DrawioFactory,
  setBackground,
  setCustomBackgroundColor
} from './widget';

/**
 * Extensions we handle
 */
const DRAWIO_EXTENSIONS = ['.drawio', '.dio'];

/**
 * File type name
 */
const FILE_TYPE_NAME = 'drawio';

/**
 * Draw.io icon SVG (orange diagram icon)
 */
const DRAWIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 161.6 161.6">
  <path fill="#D07005" d="M161.6,154.7c0,3.9-3.2,6.9-6.9,6.9H6.9c-3.9,0-6.9-3.2-6.9-6.9V6.9C0,3,3.2,0,6.9,0h147.8c3.9,0,6.9,3.2,6.9,6.9L161.6,154.7z"/>
  <path fill="#B85A0A" d="M161.6,154.7c0,3.9-3.2,6.9-6.9,6.9H55.3l-32.2-32.7l20-32.7l59.4-73.8l58.9,60.7L161.6,154.7z"/>
  <path fill="#e0e0e0" d="M132.7,90.3h-17l-18-30.6c4-0.8,7-4.4,7-8.6V28c0-4.9-3.9-8.8-8.8-8.8h-30c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.3,3,7.8,6.9,8.6L46,90.4H29c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.9,3.9,8.8,8.8,8.8h30c4.9,0,8.8-3.9,8.8-8.8V99.2c0-4.9-3.9-8.8-8.8-8.8h-2.9L73.9,60h13.9l17.9,30.4h-3c-4.9,0-8.8,3.9-8.8,8.8v23.1c0,4.9,3.9,8.8,8.8,8.8h30c4.9,0,8.8-3.9,8.8-8.8V99.2C141.5,94.3,137.6,90.3,132.7,90.3z"/>
</svg>`;

/**
 * Create Draw.io icon
 */
const drawioIcon = new LabIcon({
  name: 'drawio:icon',
  svgstr: DRAWIO_SVG
});

/**
 * Plugin ID
 */
const PLUGIN_ID = 'jupyterlab_drawio_render_extension:plugin';

/**
 * Initialization data for the jupyterlab_drawio_render_extension extension.
 */
const plugin: JupyterFrontEndPlugin<void> = {
  id: PLUGIN_ID,
  description:
    'JupyterLab extension to render Draw.io diagrams (read-only viewer)',
  autoStart: true,
  optional: [ISettingRegistry],
  activate: (
    app: JupyterFrontEnd,
    settingRegistry: ISettingRegistry | null
  ) => {
    console.log(
      'JupyterLab extension jupyterlab_drawio_render_extension is activated!'
    );
    const { docRegistry } = app;

    // Register file type with icon
    docRegistry.addFileType({
      name: FILE_TYPE_NAME,
      displayName: 'Draw.io Diagram',
      extensions: DRAWIO_EXTENSIONS,
      mimeTypes: ['application/vnd.jgraph.mxfile'],
      fileFormat: 'text',
      contentType: 'file',
      icon: drawioIcon
    });

    // Create and register widget factory
    const factory = new DrawioFactory({
      name: 'Draw.io Viewer',
      modelName: 'text',
      fileTypes: [FILE_TYPE_NAME],
      defaultFor: [FILE_TYPE_NAME],
      readOnly: true
    });

    docRegistry.addWidgetFactory(factory);

    // Load settings if available
    if (settingRegistry) {
      settingRegistry
        .load(PLUGIN_ID)
        .then(settings => {
          const updateSettings = () => {
            const background = settings.get('background').composite as string;
            const customColor = settings.get('customBackgroundColor')
              .composite as string;
            setCustomBackgroundColor(customColor);
            setBackground(background);
          };
          updateSettings();
          settings.changed.connect(updateSettings);
        })
        .catch(() => {
          // Settings not available, use defaults
        });
    }
  }
};

export default plugin;
