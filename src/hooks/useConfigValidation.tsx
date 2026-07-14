import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScoreViewerConfig } from '../types/config';

interface ConfigValidationError {
  field: string;
  message: string;
}

export const useConfigValidation = (config: ScoreViewerConfig) => {
  const { t } = useTranslation("common");

  const validateConfig = useMemo(() => (config: ScoreViewerConfig): ConfigValidationError[] => {
    const errors: ConfigValidationError[] = [];

    // Validate config exists
    if (!config) {
      errors.push({
        field: 'config',
        message: t('configValidation.configRequired')
      });
      return errors;
    }

    // Validate settings
    if (!config.settings) {
      errors.push({
        field: 'settings',
        message: t('configValidation.settingsRequired')
      });
    } else {
      const settings = config.settings;

      // Validate required boolean fields
      if (typeof settings.showScoreSelector !== 'boolean') {
        errors.push({
          field: 'settings.showScoreSelector',
          message: t('configValidation.showScoreSelectorBoolean')
        });
      }
      if (typeof settings.showTitle !== 'boolean') {
        errors.push({
          field: 'settings.showTitle',
          message: t('configValidation.showTitleBoolean')
        });
      }
      if (typeof settings.showDownloadButton !== 'boolean') {
        errors.push({
          field: 'settings.showDownloadButton',
          message: t('configValidation.showDownloadButtonBoolean')
        });
      }
      if (typeof settings.showIntroductionSection !== 'boolean') {
        errors.push({
          field: 'settings.showIntroductionSection',
          message: t('configValidation.showIntroductionSectionBoolean')
        });
      }
      if (typeof settings.showTextSection !== 'boolean') {
        errors.push({
          field: 'settings.showTextSection',
          message: t('configValidation.showTextSectionBoolean')
        });
      }
      if (typeof settings.showFacsimileSection !== 'boolean') {
        errors.push({
          field: 'settings.showFacsimileSection',
          message: t('configValidation.showFacsimileSectionBoolean')
        });
      }
      if (typeof settings.renderTitlesFromMEI !== 'boolean') {
        errors.push({
          field: 'settings.renderTitlesFromMEI',
          message: t('configValidation.renderTitlesFromMEIBoolean')
        });
      }
      if (typeof settings.allowUserLanguageChange !== 'boolean') {
        errors.push({
          field: 'settings.allowUserLanguageChange',
          message: t('configValidation.allowUserLanguageChangeBoolean')
        });
      }

      // Validate required string fields
      if (!settings.basePath || typeof settings.basePath !== 'string') {
        errors.push({
          field: 'settings.basePath',
          message: t('configValidation.basePathRequired')
        });
      }

      if (!settings.facsimileImagesPath || typeof settings.facsimileImagesPath !== 'string') {
        errors.push({
          field: 'settings.facsimileImagesPath',
          message: t('configValidation.facsimileImagesPathRequired')
        });
      }

      // Validate optional fields
      if (settings.backgroundColor && typeof settings.backgroundColor !== 'string') {
        errors.push({
          field: 'settings.backgroundColor',
          message: t('configValidation.backgroundColorString')
        });
      }

      if (settings.language && typeof settings.language !== 'string') {
        errors.push({
          field: 'settings.language',
          message: t('configValidation.languageString')
        });
      }
    }

    // Validate scores array
    if (!Array.isArray(config.scores)) {
      errors.push({
        field: 'scores',
        message: t('configValidation.scoresArray')
      });
    } else if (config.scores.length === 0) {
      errors.push({
        field: 'scores',
        message: t('configValidation.scoresNotEmpty')
      });
    } else {
      config.scores.forEach((score, index) => {
        if (!score.title || typeof score.title !== 'string') {
          errors.push({
            field: `scores[${index}].title`,
            message: t('configValidation.scoreTitleRequired')
          });
        }

        if (!score.path || typeof score.path !== 'string') {
          errors.push({
            field: `scores[${index}].path`,
            message: t('configValidation.scorePathRequired')
          });
        }

        if (!score.meiFile || typeof score.meiFile !== 'string') {
          errors.push({
            field: `scores[${index}].meiFile`,
            message: t('configValidation.scoreMeiFileRequired')
          });
        }

        if (!score.encodingProperties) {
          errors.push({
            field: `scores[${index}].encodingProperties`,
            message: t('configValidation.scoreEncodingPropertiesRequired')
          });
        }

        // Validate optional arrays
        if (score.audioOverlays && !Array.isArray(score.audioOverlays)) {
          errors.push({
            field: `scores[${index}].audioOverlays`,
            message: t('configValidation.scoreAudioOverlaysArray')
          });
        }

        if (score.facsimileItems && !Array.isArray(score.facsimileItems)) {
          errors.push({
            field: `scores[${index}].facsimileItems`,
            message: t('configValidation.scoreFacsimileItemsArray')
          });
        }
      });
    }

    return errors;
  }, [t]);

  const configErrors = useMemo(() => validateConfig(config), [config, validateConfig]);

  return {
    configErrors,
    hasConfigErrors: configErrors.length > 0
  };
};

export default useConfigValidation;
