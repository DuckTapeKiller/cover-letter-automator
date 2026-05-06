import { App, PluginSettingTab, Setting, setIcon, TFolder, TFile, AbstractInputSuggest } from 'obsidian';
import type CoverLetterPlugin from './main';
import { PROVIDER_MODELS } from './main';

export type AiProvider = 'ollama' | 'lmstudio' | 'claude' | 'gemini' | 'openai' | 'groq' | 'openrouter';

export interface CoverLetterSettings {
    // Folders
    outputFolder: string;
    interviewFolder: string;
    jobsFolder: string;
    // Identity
    senderName: string;
    senderPhone: string;
    senderEmail: string;
    candidateProfile: string;
    candidateSkills: string;
    candidateEducation: string;
    candidateExperience: string;
    // Fields
    professionalFields: string[];
    defaultField: string;
    // Design (backgroundColor removed — always white)
    marginSize: number;
    fontName: string;
    // AI Provider
    aiProvider: AiProvider;
    // Ollama
    ollamaUrl: string;
    modelName: string;
    // LM Studio
    lmStudioUrl: string;
    lmStudioModel: string;
    // Claude API
    claudeApiKey: string;
    claudeModel: string;
    // Gemini API
    geminiApiKey: string;
    geminiModel: string;
    // OpenAI API
    openaiApiKey: string;
    openaiModel: string;
    // Groq API
    groqApiKey: string;
    groqModel: string;
    // OpenRouter API
    openRouterApiKey: string;
    openRouterModel: string;
    // Customisation
    customBannedWords: string[];
    customPrompt: string;
    // Email
    cvPaths: { name: string, path: string }[];
    // Language
    language: string;
    // Signature
    signaturePath: string;
    signatureHeight: number;
    defaultTone: string;
}

export const DEFAULT_SETTINGS: CoverLetterSettings = {
    outputFolder: 'Cover Letters',
    jobsFolder: 'Jobs',
    interviewFolder: 'Interviews',
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    candidateProfile: '',
    candidateSkills: '',
    candidateEducation: '',
    candidateExperience: '',
    professionalFields: ['Software Engineering', 'Product Management', 'Data Science'],
    defaultField: 'Software Engineering',
    marginSize: 1440,
    fontName: 'Lora',
    aiProvider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    modelName: 'llama3',
    lmStudioUrl: 'http://localhost:1234',
    lmStudioModel: '',
    claudeApiKey: '',
    claudeModel: 'claude-3-5-haiku-latest',
    geminiApiKey: '',
    geminiModel: 'gemini-2.5-flash',
    openaiApiKey: '',
    openaiModel: 'gpt-4o-mini',
    groqApiKey: '',
    groqModel: 'llama-3.1-70b-versatile',
    openRouterApiKey: '',
    openRouterModel: 'mistralai/mistral-7b-instruct:free',
    cvPaths: [],
    language: 'en-GB',
    signaturePath: '',
    signatureHeight: 85,
    defaultTone: 'Standard',
    customBannedWords: ['honed', 'hone', 'esteemed', 'esteemed company', 'passionate', 'thrilled', 'excited', 'keen interest', 'profoundly', 'invaluable', 'I am writing to express my interest', 'delve', 'tapestry', 'leverage'],
    customPrompt: `You are a Senior Professional Cover Letter Writer. 

{profile}

{strategy}

TASK: Write a 4-5 paragraph cover letter based on the JOB INFO below.

JOB INFO:
{jobContent}

CRITICAL CONSTRAINTS (MANDATORY):
1. START IMMEDIATELY with the first paragraph.
2. NO HEADER: Do not include addresses, date, or "Dear..." salutations.
3. NO SALUTATION: Do not write "Dear [Name]". The template handles this.
4. NO SIGNATURE: Do not include "Regards" or your name.
5. NO PLACEHOLDERS: No [Name], [Company], etc.
6. PLAIN TEXT ONLY: No Markdown, No **bolding**, No [[Wikilinks]], No # Headers.
7. TONE: Senior Executive, Formal, Direct.
8. LANGUAGE: {language}
9. DEPTH & DETAIL: Use exactly 4-5 paragraphs. A short or brief response is a failure. Expand on the strategic match between the candidate and the job requirements using full, professional sentences.
10. RELEVANCY AUDIT: ONLY include skills and experience directly relevant to the job. If the job is administrative/service-oriented, IGNORE academic achievements or over-qualified credentials. Focus on transferable soft skills and execution.
11. MIRROR THE LEVEL: Adapt your professional persona to the seniority of the role. Do not sound boastful or over-qualified.

BANNED WORDS (DO NOT USE):
{bannedWords}

IF YOU USE THE BANNED WORDS, ANY MARKDOWN, ANY AMERICAN SPELLINGS, OR IRRELEVANT ACADEMIC BRAGGING, THE TASK IS A FAILURE.`,
};

export class CoverLetterSettingTab extends PluginSettingTab {
    plugin: CoverLetterPlugin;

    constructor(app: App, plugin: CoverLetterPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Cover Letter Automator' });

        // ── SENDER IDENTITY ──────────────────────────────────────────────
        const identitySection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        identitySection.open = true;
        const identitySummary = identitySection.createEl('summary');
        setIcon(identitySummary, 'user');
        identitySummary.createSpan({ text: ' Sender Identity' });

        new Setting(identitySection)
            .setName('Full Name')
            .addText(t => t.setPlaceholder('DuckTapeKiller')
                .setValue(this.plugin.settings.senderName)
                .onChange(async v => { this.plugin.settings.senderName = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('Phone')
            .addText(t => t.setPlaceholder('+44 7700 000000')
                .setValue(this.plugin.settings.senderPhone)
                .onChange(async v => { this.plugin.settings.senderPhone = v; await this.plugin.saveSettings(); }));

        new Setting(identitySection)
            .setName('Email')
            .addText(t => t.setPlaceholder('you@email.com')
                .setValue(this.plugin.settings.senderEmail)
                .onChange(async v => { this.plugin.settings.senderEmail = v; await this.plugin.saveSettings(); }));


        new Setting(identitySection)
            .setName('Professional Fields')
            .setDesc('Comma-separated list of fields shown in the generation modal.')
            .addTextArea(t => t
                .setValue(this.plugin.settings.professionalFields.join(', '))
                .onChange(async v => {
                    this.plugin.settings.professionalFields = v.split(',').map(s => s.trim()).filter(Boolean);
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to update Default Field dropdown
                }));

        new Setting(identitySection)
            .setName('Default Field')
            .setDesc('This field will be pre-selected in the generation modal.')
            .addDropdown(dd => {
                this.plugin.settings.professionalFields.forEach(f => dd.addOption(f, f));
                dd.setValue(this.plugin.settings.defaultField);
                dd.onChange(async v => {
                    this.plugin.settings.defaultField = v;
                    await this.plugin.saveSettings();
                });
            });

        // ── CANDIDATE PROFILE ──────────────────────────────────────────────
        const profileSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        profileSection.open = true;
        const profileSummary = profileSection.createEl('summary');
        setIcon(profileSummary, 'book-open');
        profileSummary.createSpan({ text: ' Candidate Profile' });

        new Setting(profileSection)
            .setName('Professional Summary')
            .addTextArea(t => {
                t.inputEl.rows = 6;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.setValue(this.plugin.settings.candidateProfile).onChange(async v => { this.plugin.settings.candidateProfile = v; await this.plugin.saveSettings(); });
            });

        new Setting(profileSection)
            .setName('Skills')
            .addTextArea(t => {
                t.inputEl.rows = 6;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.setValue(this.plugin.settings.candidateSkills).onChange(async v => { this.plugin.settings.candidateSkills = v; await this.plugin.saveSettings(); });
            });

        new Setting(profileSection)
            .setName('Education')
            .addTextArea(t => {
                t.inputEl.rows = 8;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.setValue(this.plugin.settings.candidateEducation).onChange(async v => { this.plugin.settings.candidateEducation = v; await this.plugin.saveSettings(); });
            });

        const expSet = new Setting(profileSection)
            .setName('Work Experience')
            .setDesc('Your full career history.')
            .addTextArea(t => {
                t.inputEl.rows = 15;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.setValue(this.plugin.settings.candidateExperience).onChange(async v => { this.plugin.settings.candidateExperience = v; await this.plugin.saveSettings(); });
            });
        expSet.settingEl.style.flexDirection = 'column';
        expSet.settingEl.style.alignItems = 'flex-start';
        expSet.controlEl.style.width = '100%';
        expSet.controlEl.style.marginTop = '10px';

        // ── AI PROVIDER ──────────────────────────────────────────────────
        const aiSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        aiSection.open = true;
        aiSection.createEl('summary', { text: '◈ AI Providers' });

        new Setting(aiSection)
            .setName('Active Provider')
            .setDesc('Choose which AI service generates the cover letter body.')
            .addDropdown(dd => {
                dd.addOption('ollama', 'Ollama (local)');
                dd.addOption('lmstudio', 'LM Studio (local)');
                dd.addOption('claude', 'Anthropic Claude (API)');
                dd.addOption('gemini', 'Google Gemini (API)');
                dd.addOption('openai', 'OpenAI GPT (API)');
                dd.addOption('groq', 'Groq (High Speed)');
                dd.addOption('openrouter', 'OpenRouter (Free/Aggregator)');
                dd.setValue(this.plugin.settings.aiProvider);
                dd.onChange(async v => {
                    this.plugin.settings.aiProvider = v as AiProvider;
                    await this.plugin.saveSettings();
                    this.display(); // re-render to show/hide sub-settings
                });
            });

        new Setting(aiSection)
            .setName('Default Tone')
            .setDesc('The default writing style for your letters.')
            .addDropdown(dd => {
                dd.addOption('Standard', 'Standard Professional');
                dd.addOption('Formal', 'Formal / Executive');
                dd.addOption('Brief', 'Brief / Concise');
                dd.addOption('Aggressive', 'Aggressive / High Energy');
                dd.addOption('Conversational', 'Conversational / Friendly');
                dd.setValue(this.plugin.settings.defaultTone);
                dd.onChange(async v => {
                    this.plugin.settings.defaultTone = v;
                    await this.plugin.saveSettings();
                });
            });

        if (this.plugin.settings.aiProvider === 'ollama') {
            const ollamaModels = await this.plugin.fetchOllamaModels();

            new Setting(aiSection)
                .setName('Ollama URL')
                .addText(t => t.setPlaceholder('http://localhost:11434')
                    .setValue(this.plugin.settings.ollamaUrl)
                    .onChange(async v => { this.plugin.settings.ollamaUrl = v; await this.plugin.saveSettings(); }))
                .addButton(btn => btn.setButtonText('Refresh Models').onClick(() => this.display()));

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Select from your local Ollama models.')
                .addDropdown(dd => {
                    if (ollamaModels.length > 0) {
                        ollamaModels.forEach(m => dd.addOption(m, m));
                    } else {
                        ['llama3', 'mistral', 'gemma'].forEach(m => dd.addOption(m, m));
                    }
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.modelName;
                    dd.setValue(ollamaModels.includes(current) || ['llama3', 'mistral', 'gemma'].includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') {
                            this.plugin.settings.modelName = v;
                            await this.plugin.saveSettings();
                        }
                        this.display();
                    });
                });

            if (!ollamaModels.includes(this.plugin.settings.modelName) && !['llama3', 'mistral', 'gemma'].includes(this.plugin.settings.modelName)) {
                new Setting(aiSection)
                    .setName('Custom Ollama Model')
                    .addText(t => t
                        .setPlaceholder('llama3:8b')
                        .setValue(this.plugin.settings.modelName === 'custom' ? '' : this.plugin.settings.modelName)
                        .onChange(async v => {
                            this.plugin.settings.modelName = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'lmstudio') {
            const lmModels = await this.plugin.fetchLmStudioModels();

            new Setting(aiSection)
                .setName('LM Studio URL')
                .setDesc('Base URL of your LM Studio local server.')
                .addText(t => t.setPlaceholder('http://localhost:1234')
                    .setValue(this.plugin.settings.lmStudioUrl)
                    .onChange(async v => { this.plugin.settings.lmStudioUrl = v; await this.plugin.saveSettings(); }))
                .addButton(btn => btn.setButtonText('Refresh Models').onClick(() => this.display()));

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Select from your loaded LM Studio models.')
                .addDropdown(dd => {
                    if (lmModels.length > 0) {
                        lmModels.forEach(m => dd.addOption(m, m));
                    } else {
                        dd.addOption('', '— No models loaded — start LM Studio server first —');
                    }
                    const current = this.plugin.settings.lmStudioModel;
                    if (current && lmModels.includes(current)) dd.setValue(current);
                    dd.onChange(async v => {
                        this.plugin.settings.lmStudioModel = v;
                        await this.plugin.saveSettings();
                    });
                });
        }

        if (this.plugin.settings.aiProvider === 'claude') {
            new Setting(aiSection)
                .setName('Anthropic API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('sk-ant-...')
                        .setValue(this.plugin.settings.claudeApiKey)
                        .onChange(async v => { this.plugin.settings.claudeApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your Claude model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.claude;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.claudeModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.claudeModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.claude.includes(this.plugin.settings.claudeModel)) {
                new Setting(aiSection)
                    .setName('Custom Claude Model')
                    .addText(t => t
                        .setPlaceholder('claude-2.1')
                        .setValue(this.plugin.settings.claudeModel === 'custom' ? '' : this.plugin.settings.claudeModel)
                        .onChange(async v => {
                            this.plugin.settings.claudeModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'gemini') {
            new Setting(aiSection)
                .setName('Google API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('AIza...')
                        .setValue(this.plugin.settings.geminiApiKey)
                        .onChange(async v => { this.plugin.settings.geminiApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your Gemini model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.gemini;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.geminiModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.geminiModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.gemini.includes(this.plugin.settings.geminiModel)) {
                new Setting(aiSection)
                    .setName('Custom Gemini Model')
                    .addText(t => t
                        .setPlaceholder('gemini-2.5-flash')
                        .setValue(this.plugin.settings.geminiModel === 'custom' ? '' : this.plugin.settings.geminiModel)
                        .onChange(async v => {
                            this.plugin.settings.geminiModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'openai') {
            new Setting(aiSection)
                .setName('OpenAI API Key')
                .setDesc('Stored only in your local vault data.')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('sk-...')
                        .setValue(this.plugin.settings.openaiApiKey)
                        .onChange(async v => { this.plugin.settings.openaiApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your GPT model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.openai;
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.openaiModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.openaiModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.openai.includes(this.plugin.settings.openaiModel)) {
                new Setting(aiSection)
                    .setName('Custom GPT Model')
                    .addText(t => t
                        .setPlaceholder('gpt-4')
                        .setValue(this.plugin.settings.openaiModel === 'custom' ? '' : this.plugin.settings.openaiModel)
                        .onChange(async v => {
                            this.plugin.settings.openaiModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }
        
        if (this.plugin.settings.aiProvider === 'groq') {
            new Setting(aiSection)
                .setName('Groq API Key')
                .setDesc('Get yours at console.groq.com')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('gsk_...')
                        .setValue(this.plugin.settings.groqApiKey)
                        .onChange(async v => { this.plugin.settings.groqApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your Groq model.')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.groq || ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'];
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.groqModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.groqModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.groq?.includes(this.plugin.settings.groqModel)) {
                new Setting(aiSection)
                    .setName('Custom Groq Model')
                    .addText(t => t
                        .setPlaceholder('llama3-70b-8192')
                        .setValue(this.plugin.settings.groqModel === 'custom' ? '' : this.plugin.settings.groqModel)
                        .onChange(async v => {
                            this.plugin.settings.groqModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        if (this.plugin.settings.aiProvider === 'openrouter') {
            new Setting(aiSection)
                .setName('OpenRouter API Key')
                .setDesc('Get yours at openrouter.ai')
                .addText(t => {
                    t.inputEl.type = 'password';
                    t.setPlaceholder('sk-or-...')
                        .setValue(this.plugin.settings.openRouterApiKey)
                        .onChange(async v => { this.plugin.settings.openRouterApiKey = v; await this.plugin.saveSettings(); });
                });

            new Setting(aiSection)
                .setName('Model')
                .setDesc('Choose your OpenRouter model (or use Free ones).')
                .addDropdown(dd => {
                    const models = PROVIDER_MODELS.openrouter || ['mistralai/mistral-7b-instruct:free', 'google/gemma-7b-it:free', 'openchat/openchat-7b:free'];
                    models.forEach(m => dd.addOption(m, m));
                    dd.addOption('custom', 'Custom Model Name...');

                    const current = this.plugin.settings.openRouterModel;
                    dd.setValue(models.includes(current) ? current : 'custom');

                    dd.onChange(async v => {
                        if (v !== 'custom') this.plugin.settings.openRouterModel = v;
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            if (!PROVIDER_MODELS.openrouter?.includes(this.plugin.settings.openRouterModel)) {
                new Setting(aiSection)
                    .setName('Custom OpenRouter Model')
                    .addText(t => t
                        .setPlaceholder('mistralai/mixtral-8x7b-instruct')
                        .setValue(this.plugin.settings.openRouterModel === 'custom' ? '' : this.plugin.settings.openRouterModel)
                        .onChange(async v => {
                            this.plugin.settings.openRouterModel = v;
                            await this.plugin.saveSettings();
                        }));
            }
        }

        // ── DESIGN & FOLDERS ─────────────────────────────────────────────
        const designSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        designSection.open = true;
        const designSummary = designSection.createEl('summary');
        setIcon(designSummary, 'palette');
        designSummary.createSpan({ text: ' Design & Folders' });

        new Setting(designSection)
            .setName('Font Family')
            .setDesc('Must be installed on your system (PDF) or available to docx viewers.')
            .addText(t => t.setPlaceholder('Lora')
                .setValue(this.plugin.settings.fontName)
                .onChange(async v => { this.plugin.settings.fontName = v; await this.plugin.saveSettings(); }));

        new Setting(designSection)
            .setName('Page Margin (twips)')
            .setDesc('1440 twips = 1 inch. Range: 720 (½ in) – 2880 (2 in).')
            .addSlider(s => s.setLimits(720, 2880, 120)
                .setValue(this.plugin.settings.marginSize)
                .setDynamicTooltip()
                .onChange(async v => { this.plugin.settings.marginSize = v; await this.plugin.saveSettings(); }));

        new Setting(designSection)
            .setName('Signature Image')
            .setDesc('Optional: Path to a PNG of your handwritten signature (transparent background recommended).')
            .addText(t => {
                new FileSuggest(this.app, t.inputEl);
                t.setPlaceholder('Assets/signature.png')
                    .setValue(this.plugin.settings.signaturePath)
                    .onChange(async v => { this.plugin.settings.signaturePath = v; await this.plugin.saveSettings(); });
            });
        
        new Setting(designSection)
            .setName('Signature Height')
            .setDesc('Adjust the size of your signature in the PDF (in pixels). Default: 85.')
            .addSlider(s => s
                .setLimits(30, 200, 5)
                .setValue(this.plugin.settings.signatureHeight)
                .setDynamicTooltip()
                .onChange(async v => {
                    this.plugin.settings.signatureHeight = v;
                    await this.plugin.saveSettings();
                }));

        new Setting(designSection)
            .setName('Output Folder')
            .setDesc('Vault path where generated files are saved.')
            .addText(t => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Cover Letters')
                    .setValue(this.plugin.settings.outputFolder)
                    .onChange(async v => { this.plugin.settings.outputFolder = v; await this.plugin.saveSettings(); });
            });

        new Setting(designSection)
            .setName('Interview Prep Folder')
            .setDesc('Vault path where interview playbooks are saved.')
            .addText(t => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Interviews')
                    .setValue(this.plugin.settings.interviewFolder)
                    .onChange(async v => { this.plugin.settings.interviewFolder = v; await this.plugin.saveSettings(); });
            });

        new Setting(designSection)
            .setName('Jobs Folder')
            .setDesc('Vault path where imported job notes are saved.')
            .addText(t => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Jobs')
                    .setValue(this.plugin.settings.jobsFolder)
                    .onChange(async v => { this.plugin.settings.jobsFolder = v; await this.plugin.saveSettings(); });
            });

        // ── CV LIBRARY ──────────────────────────────────────────────────
        const cvSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        cvSection.open = true;
        const cvSummary = cvSection.createEl('summary');
        setIcon(cvSummary, 'folder-heart');
        cvSummary.createSpan({ text: ' CV Library' });

        new Setting(cvSection)
            .setName('Add CV to Library')
            .setDesc('Add a new CV version to your collection.')
            .addButton(btn => btn
                .setButtonText('+ Add CV')
                .onClick(async () => {
                    this.plugin.settings.cvPaths.push({ name: 'New CV', path: '' });
                    await this.plugin.saveSettings();
                    this.display();
                }));

        this.plugin.settings.cvPaths.forEach((cv, i) => {
            const s = new Setting(cvSection)
                .addText(t => t
                    .setPlaceholder('Label (e.g. Developer CV)')
                    .setValue(cv.name)
                    .onChange(async v => {
                        this.plugin.settings.cvPaths[i].name = v;
                        await this.plugin.saveSettings();
                    }))
                .addText(t => {
                    new FileSuggest(this.app, t.inputEl);
                    t.setPlaceholder('Path/to/CV.pdf')
                        .setValue(cv.path)
                        .onChange(async v => {
                            this.plugin.settings.cvPaths[i].path = v;
                            await this.plugin.saveSettings();
                        });
                })
                .addExtraButton(eb => eb
                    .setIcon('trash')
                    .setTooltip('Remove CV')
                    .onClick(async () => {
                        this.plugin.settings.cvPaths.splice(i, 1);
                        await this.plugin.saveSettings();
                        this.display();
                    }));
            s.infoEl.remove(); // Keep it compact
        });

        // ── LANGUAGE ─────────────────────────────────────────────────────
        const langSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        langSection.open = true;
        const langSummary = langSection.createEl('summary');
        setIcon(langSummary, 'languages');
        langSummary.createSpan({ text: ' Language' });

        new Setting(langSection)
            .setName('Output Language')
            .setDesc('The language the AI will use to write the cover letter and email.')
            .addDropdown(dd => {
                dd.addOption('en-GB', 'British English');
                dd.addOption('es', 'Spanish');
                dd.addOption('en-US', 'American English');
                dd.setValue(this.plugin.settings.language);
                dd.onChange(async v => {
                    this.plugin.settings.language = v;
                    await this.plugin.saveSettings();
                });
            });

        // ── AI CUSTOMISATION ─────────────────────────────────────────────
        const customSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        customSection.open = false;
        const customSummary = customSection.createEl('summary');
        setIcon(customSummary, 'settings-2');
        customSummary.createSpan({ text: ' AI Customisation (Advanced)' });

        new Setting(customSection)
            .setName('Custom Banned Words')
            .setDesc('Comma-separated list of words/phrases the AI is forbidden to use.')
            .addTextArea(t => t
                .setValue(this.plugin.settings.customBannedWords.join(', '))
                .onChange(async v => {
                    this.plugin.settings.customBannedWords = v.split(',').map(s => s.trim()).filter(Boolean);
                    await this.plugin.saveSettings();
                }));
        customSection.querySelectorAll('textarea').forEach(ta => {
            ta.style.width = '100%';
            ta.style.resize = 'vertical';
            ta.rows = 4;
        });

        const promptSet = new Setting(customSection)
            .setName('Base Prompt')
            .setDesc('Modify the core AI instructions. Use {profile}, {strategy}, {jobContent}, {language}, and {bannedWords}.')
            .addTextArea(t => {
                t.inputEl.rows = 30;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.inputEl.style.fontFamily = 'monospace';
                t.setValue(this.plugin.settings.customPrompt)
                    .onChange(async v => {
                        this.plugin.settings.customPrompt = v;
                        await this.plugin.saveSettings();
                    });
            });
        promptSet.settingEl.style.flexDirection = 'column';
        promptSet.settingEl.style.alignItems = 'flex-start';
        promptSet.controlEl.style.width = '100%';
        promptSet.controlEl.style.marginTop = '10px';
    }
}

// ── SUGGESTERS ───────────────────────────────────────────────────────────

class FolderSuggest extends AbstractInputSuggest<string> {
    private __targetEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.__targetEl = inputEl;
        this.selectSuggestion = this.selectSuggestion.bind(this);
    }

    getSuggestions(inputStr: string): string[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const folders: string[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach(file => {
            if (file instanceof TFolder && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                folders.push(file.path);
            }
        });

        return folders;
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.__targetEl) {
            this.__targetEl.value = value;
            this.__targetEl.dispatchEvent(new Event('input'));
            this.__targetEl.dispatchEvent(new Event('change'));
        }
        this.close();
    }
}

class FileSuggest extends AbstractInputSuggest<string> {
    private __targetEl: HTMLInputElement;
    constructor(app: App, inputEl: HTMLInputElement) {
        super(app, inputEl);
        this.__targetEl = inputEl;
        this.selectSuggestion = this.selectSuggestion.bind(this);
    }

    getSuggestions(inputStr: string): string[] {
        const abstractFiles = this.app.vault.getAllLoadedFiles();
        const files: string[] = [];
        const lowerCaseInputStr = inputStr.toLowerCase();

        abstractFiles.forEach(file => {
            if (file instanceof TFile && file.path.toLowerCase().contains(lowerCaseInputStr)) {
                files.push(file.path);
            }
        });

        return files;
    }

    renderSuggestion(value: string, el: HTMLElement): void {
        el.setText(value);
    }

    selectSuggestion(value: string, evt: MouseEvent | KeyboardEvent): void {
        if (this.__targetEl) {
            this.__targetEl.value = value;
            this.__targetEl.dispatchEvent(new Event('input'));
            this.__targetEl.dispatchEvent(new Event('change'));
        }
        this.close();
    }
}
