import { useEffect, useRef, useState } from 'react';

export function useLandingTemplates({ enabled, createOpen, startMode, tab, workspaceOpen, showToast }) {
  const templateModuleRef = useRef(null);
  const [templateChoices, setTemplateChoices] = useState([]);

  const loadTemplateModule = async () => {
    if (templateModuleRef.current) return templateModuleRef.current;
    const module = await import('../templates/landingTemplates.js');
    templateModuleRef.current = module;
    setTemplateChoices(module.LANDING_TEMPLATES.map((template) => module.getLandingTemplate(template.id)));
    return module;
  };

  useEffect(() => {
    if (!enabled) return;
    if (workspaceOpen && !createOpen && startMode !== 'template' && tab !== 'templates') return;
    loadTemplateModule().catch((error) => {
      console.warn('Template module load failed:', error);
      showToast?.(`템플릿을 불러오지 못했습니다. ${String(error?.message || error)}`, 'error');
    });
  }, [enabled, createOpen, startMode, tab, workspaceOpen]);

  return { templateChoices, loadTemplateModule };
}
