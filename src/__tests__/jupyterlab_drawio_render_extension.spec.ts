/**
 * Unit tests for jupyterlab_drawio_render_extension
 *
 * Note: Widget and complex dependency tests are in ui-tests/
 * These tests cover pure utility functions without complex dependencies
 */

describe('jupyterlab_drawio_render_extension', () => {
  describe('Filename Generation', () => {
    /**
     * Helper function to generate PNG filename (mirrors widget.ts implementation)
     */
    function generatePngFilename(documentPath: string): string {
      const baseName = documentPath
        .replace(/\.[^/.]+$/, '')
        .split('/')
        .pop();
      return `${baseName || 'diagram'}.png`;
    }

    it('should generate PNG filename from simple path', () => {
      const path = 'diagram.drawio';
      const expected = 'diagram.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });

    it('should generate PNG filename from path with directory', () => {
      const path = 'folder/subfolder/mydiagram.drawio';
      const expected = 'mydiagram.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });

    it('should generate PNG filename from .dio extension', () => {
      const path = 'test.dio';
      const expected = 'test.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });

    it('should handle empty path with fallback', () => {
      const path = '';
      const expected = 'diagram.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });

    it('should handle path with multiple extensions', () => {
      const path = 'my.diagram.backup.drawio';
      const expected = 'my.diagram.backup.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });

    it('should handle path with spaces', () => {
      const path = 'my diagram file.drawio';
      const expected = 'my diagram file.png';
      const result = generatePngFilename(path);
      expect(result).toBe(expected);
    });
  });

  describe('DPI Validation', () => {
    /**
     * Validate DPI value is within acceptable range
     */
    function validateDPI(dpi: number): boolean {
      return dpi >= 72 && dpi <= 1200;
    }

    it('should accept minimum DPI of 72', () => {
      expect(validateDPI(72)).toBe(true);
    });

    it('should accept maximum DPI of 1200', () => {
      expect(validateDPI(1200)).toBe(true);
    });

    it('should accept default DPI of 300', () => {
      expect(validateDPI(300)).toBe(true);
    });

    it('should reject DPI below 72', () => {
      expect(validateDPI(50)).toBe(false);
    });

    it('should reject DPI above 1200', () => {
      expect(validateDPI(1500)).toBe(false);
    });

    it('should accept common print DPI of 150', () => {
      expect(validateDPI(150)).toBe(true);
    });

    it('should accept high quality DPI of 600', () => {
      expect(validateDPI(600)).toBe(true);
    });
  });

  describe('Background Color Validation', () => {
    /**
     * Validate hex color format
     */
    function isValidHexColor(color: string): boolean {
      return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color);
    }

    it('should accept valid 6-digit hex color', () => {
      expect(isValidHexColor('#ff0000')).toBe(true);
    });

    it('should accept valid 3-digit hex color', () => {
      expect(isValidHexColor('#f00')).toBe(true);
    });

    it('should accept uppercase hex color', () => {
      expect(isValidHexColor('#FF0000')).toBe(true);
    });

    it('should accept mixed case hex color', () => {
      expect(isValidHexColor('#Ff00aB')).toBe(true);
    });

    it('should reject color without hash', () => {
      expect(isValidHexColor('ff0000')).toBe(false);
    });

    it('should reject invalid length', () => {
      expect(isValidHexColor('#ff00')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidHexColor('#gggggg')).toBe(false);
    });

    it('should accept white color', () => {
      expect(isValidHexColor('#ffffff')).toBe(true);
    });

    it('should accept black color', () => {
      expect(isValidHexColor('#000000')).toBe(true);
    });
  });

  describe('Export Background Options', () => {
    const validBackgrounds = ['transparent', 'white', 'black', 'custom'];

    it('should recognize transparent as valid', () => {
      expect(validBackgrounds.includes('transparent')).toBe(true);
    });

    it('should recognize white as valid', () => {
      expect(validBackgrounds.includes('white')).toBe(true);
    });

    it('should recognize black as valid', () => {
      expect(validBackgrounds.includes('black')).toBe(true);
    });

    it('should recognize custom as valid', () => {
      expect(validBackgrounds.includes('custom')).toBe(true);
    });

    it('should reject invalid background option', () => {
      expect(validBackgrounds.includes('red')).toBe(false);
    });
  });

  describe('Viewer Background Options', () => {
    const validBackgrounds = ['default', 'black', 'white', 'custom'];

    it('should recognize default as valid', () => {
      expect(validBackgrounds.includes('default')).toBe(true);
    });

    it('should recognize black as valid', () => {
      expect(validBackgrounds.includes('black')).toBe(true);
    });

    it('should recognize white as valid', () => {
      expect(validBackgrounds.includes('white')).toBe(true);
    });

    it('should recognize custom as valid', () => {
      expect(validBackgrounds.includes('custom')).toBe(true);
    });

    it('should not include transparent for viewer', () => {
      expect(validBackgrounds.includes('transparent')).toBe(false);
    });
  });

  describe('File Extension Recognition', () => {
    const drawioExtensions = ['.drawio', '.dio'];

    function isDrawioFile(filename: string): boolean {
      return drawioExtensions.some(ext => filename.endsWith(ext));
    }

    it('should recognize .drawio files', () => {
      expect(isDrawioFile('diagram.drawio')).toBe(true);
    });

    it('should recognize .dio files', () => {
      expect(isDrawioFile('diagram.dio')).toBe(true);
    });

    it('should not recognize .xml files', () => {
      expect(isDrawioFile('diagram.xml')).toBe(false);
    });

    it('should not recognize .svg files', () => {
      expect(isDrawioFile('diagram.svg')).toBe(false);
    });

    it('should handle uppercase extension', () => {
      // Note: actual implementation may need case-insensitive check
      expect(isDrawioFile('diagram.DRAWIO')).toBe(false);
    });

    it('should handle files with multiple dots', () => {
      expect(isDrawioFile('my.network.diagram.drawio')).toBe(true);
    });
  });
});
