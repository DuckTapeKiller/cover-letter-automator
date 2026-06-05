import {
    AbstractInputSuggest,
    App,
    PluginSettingTab,
    SecretComponent,
    Setting,
    TFile,
    TFolder,
    setIcon,
} from 'obsidian';
import type CoverLetterPlugin from './main';
import { PROVIDER_MODELS } from './main';

export type AiProvider = 'ollama' | 'lmstudio' | 'claude' | 'gemini' | 'openai' | 'groq' | 'openrouter';

export interface CoverLetterSettings {
    // Folders
    outputFolder: string;
    interviewFolder: string;
    jobsFolder: string;

    // Job dashboard
    jobDashboardSeenIds: string[];
    jobDashboardDismissedIds: string[];
    jobDashboardAppliedIds: string[];
    jobDashboardPinnedIds: string[];
    jobDashboardLastRefresh: string;
    jobDashboardAutoRefresh: boolean;
    jobDashboardRefreshIntervalMinutes: number;
    jobDashboardRefreshOnStartup: boolean;

    // Identity
    senderName: string;
    senderPhone: string;
    senderEmail: string;

    // Candidate profile
    candidateProfile: string;
    candidateSkills: string;
    candidateEducation: string;
    candidateExperience: string;

    // Fields
    professionalFields: string[];
    defaultField: string;

    // Design
    marginSize: number;
    fontName: string;
    signaturePath: string;
    signatureHeight: number;

    // AI Provider
    aiProvider: AiProvider;

    // Ollama
    ollamaUrl: string;
    modelName: string;
    ollamaContextWindow: number;
    ollamaFirstTokenTimeoutSeconds: number;
    ollamaIdleTimeoutSeconds: number;
    ollamaMaxRequestMinutes: number;

    // LM Studio
    lmStudioUrl: string;
    lmStudioModel: string;

    // Claude (Secret Storage)
    claudeSecretId: string;
    claudeModel: string;

    // Gemini (Secret Storage)
    geminiSecretId: string;
    geminiModel: string;

    // OpenAI (Secret Storage)
    openaiSecretId: string;
    openaiModel: string;

    // Groq (Secret Storage)
    groqSecretId: string;
    groqModel: string;

    // OpenRouter (Secret Storage)
    openRouterSecretId: string;
    openRouterModel: string;

    // Customisation
    customBannedWords: string[];
    customPrompt: string;
    defaultTone: string;
    enableStrategyAnalysis: boolean;
    lastCoverLetterGenerationMs: number;

    // Email/CV
    cvPaths: { name: string; path: string }[];

    // Language
    language: string;
}

export const DEFAULT_SETTINGS: CoverLetterSettings = {
    outputFolder: 'Cover Letters',
    jobsFolder: 'Jobs',
    interviewFolder: 'Interviews',

    jobDashboardSeenIds: [],
    jobDashboardDismissedIds: [],
    jobDashboardAppliedIds: [],
    jobDashboardPinnedIds: [],
    jobDashboardLastRefresh: '',
    jobDashboardAutoRefresh: false,
    jobDashboardRefreshIntervalMinutes: 180,
    jobDashboardRefreshOnStartup: true,

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
    signaturePath: '',
    signatureHeight: 85,

    aiProvider: 'ollama',
    ollamaUrl: 'http://localhost:11434',
    modelName: 'llama3',
    ollamaContextWindow: 8192,
    ollamaFirstTokenTimeoutSeconds: 300,
    ollamaIdleTimeoutSeconds: 180,
    ollamaMaxRequestMinutes: 10,

    lmStudioUrl: 'http://localhost:1234',
    lmStudioModel: '',

    claudeSecretId: '',
    claudeModel: 'claude-3-5-haiku-latest',

    geminiSecretId: '',
    geminiModel: 'gemini-2.5-flash',

    openaiSecretId: '',
    openaiModel: 'gpt-4o-mini',

    groqSecretId: '',
    groqModel: 'llama-3.1-70b-versatile',

    openRouterSecretId: '',
    openRouterModel: 'mistralai/mistral-7b-instruct:free',

    cvPaths: [],
    language: 'en-GB',

    defaultTone: 'Standard',
    enableStrategyAnalysis: false,
    lastCoverLetterGenerationMs: 0,
    customBannedWords: [
        'honed',
        'hone',
        'esteemed',
        'esteemed company',
        'passionate',
        'thrilled',
        'excited',
        'keen interest',
        'profoundly',
        'invaluable',
        'I am writing to express my interest',
        'delve',
        'tapestry',
        'leverage',
    ],
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

    private buildModelCombo(
        setting: Setting,
        datalistId: string,
        getModels: () => Promise<string[]>,
        value: string,
        onSet: (model: string) => void | Promise<void>
    ): void {
        setting.addText((t) => {
            t.setPlaceholder('Type or select a model…');
            t.inputEl.setCssProps({ width: '100%' });

            const doc = (window as any).activeDocument ?? document;
            const datalist = doc.createElement('datalist');
            datalist.id = datalistId;
            t.inputEl.setAttribute('list', datalistId);
            t.inputEl.after(datalist);

            t.setValue(value);

            getModels()
                .then((models) => {
                    models.forEach((m) => {
                        const opt = doc.createElement('option');
                        opt.value = m;
                        datalist.appendChild(opt);
                    });
                })
                .catch(() => {});

            t.onChange((v) => {
                const model = v.trim();
                if (model) void onSet(model);
            });
        });
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

        new Setting(identitySection).setName('Full Name').addText((t) =>
            t
                .setPlaceholder('DuckTapeKiller')
                .setValue(this.plugin.settings.senderName)
                .onChange(async (v) => {
                    this.plugin.settings.senderName = v;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(identitySection).setName('Phone').addText((t) =>
            t
                .setPlaceholder('+44 7700 000000')
                .setValue(this.plugin.settings.senderPhone)
                .onChange(async (v) => {
                    this.plugin.settings.senderPhone = v;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(identitySection).setName('Email').addText((t) =>
            t
                .setPlaceholder('you@email.com')
                .setValue(this.plugin.settings.senderEmail)
                .onChange(async (v) => {
                    this.plugin.settings.senderEmail = v;
                    await this.plugin.saveSettings();
                })
        );

        new Setting(identitySection)
            .setName('Professional Fields')
            .setDesc('Comma-separated list of fields shown in the generation modal.')
            .addTextArea((t) =>
                t.setValue(this.plugin.settings.professionalFields.join(', ')).onChange(async (v) => {
                    this.plugin.settings.professionalFields = v
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        new Setting(identitySection)
            .setName('Default Field')
            .setDesc('This field will be pre-selected in the generation modal.')
            .addDropdown((dd) => {
                this.plugin.settings.professionalFields.forEach((f) => dd.addOption(f, f));
                dd.setValue(this.plugin.settings.defaultField);
                dd.onChange(async (v) => {
                    this.plugin.settings.defaultField = v;
                    await this.plugin.saveSettings();
                });
            });

        // ── CANDIDATE PROFILE ────────────────────────────────────────────
        const profileSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        profileSection.open = true;
        const profileSummary = profileSection.createEl('summary');
        setIcon(profileSummary, 'book-open');
        profileSummary.createSpan({ text: ' Candidate Profile' });

        new Setting(profileSection).setName('Professional Summary').addTextArea((t) => {
            t.inputEl.rows = 6;
            t.inputEl.style.width = '100%';
            t.inputEl.style.resize = 'vertical';
            t.setValue(this.plugin.settings.candidateProfile).onChange(async (v) => {
                this.plugin.settings.candidateProfile = v;
                await this.plugin.saveSettings();
            });
        });

        new Setting(profileSection).setName('Skills').addTextArea((t) => {
            t.inputEl.rows = 6;
            t.inputEl.style.width = '100%';
            t.inputEl.style.resize = 'vertical';
            t.setValue(this.plugin.settings.candidateSkills).onChange(async (v) => {
                this.plugin.settings.candidateSkills = v;
                await this.plugin.saveSettings();
            });
        });

        new Setting(profileSection).setName('Education').addTextArea((t) => {
            t.inputEl.rows = 8;
            t.inputEl.style.width = '100%';
            t.inputEl.style.resize = 'vertical';
            t.setValue(this.plugin.settings.candidateEducation).onChange(async (v) => {
                this.plugin.settings.candidateEducation = v;
                await this.plugin.saveSettings();
            });
        });

        const expSet = new Setting(profileSection)
            .setName('Work Experience')
            .setDesc('Your full career history.')
            .addTextArea((t) => {
                t.inputEl.rows = 15;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.setValue(this.plugin.settings.candidateExperience).onChange(async (v) => {
                    this.plugin.settings.candidateExperience = v;
                    await this.plugin.saveSettings();
                });
            });
        expSet.settingEl.style.flexDirection = 'column';
        expSet.settingEl.style.alignItems = 'flex-start';
        expSet.controlEl.style.width = '100%';
        expSet.controlEl.style.marginTop = '10px';

        // ── AI PROVIDERS ─────────────────────────────────────────────────
        const aiSection = containerEl.createEl('details', { cls: 'cla-settings-section' });
        aiSection.open = true;
        aiSection.createEl('summary', { text: '◈ AI Providers' });

        new Setting(aiSection)
            .setName('Active Provider')
            .setDesc('Choose which AI service generates the cover letter body.')
            .addDropdown((dd) => {
                dd.addOption('ollama', 'Ollama (local)');
                dd.addOption('lmstudio', 'LM Studio (local)');
                dd.addOption('claude', 'Anthropic Claude (API)');
                dd.addOption('gemini', 'Google Gemini (API)');
                dd.addOption('openai', 'OpenAI GPT (API)');
                dd.addOption('groq', 'Groq (High Speed)');
                dd.addOption('openrouter', 'OpenRouter (Free/Aggregator)');
                dd.setValue(this.plugin.settings.aiProvider);
                dd.onChange(async (v) => {
                    this.plugin.settings.aiProvider = v as AiProvider;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(aiSection)
            .setName('Default Tone')
            .setDesc('The default writing style for your letters.')
            .addDropdown((dd) => {
                dd.addOption('Standard', 'Standard Professional');
                dd.addOption('Formal', 'Formal / Executive');
                dd.addOption('Brief', 'Brief / Concise');
                dd.addOption('Aggressive', 'Aggressive / High Energy');
                dd.addOption('Conversational', 'Conversational / Friendly');
                dd.setValue(this.plugin.settings.defaultTone);
                dd.onChange(async (v) => {
                    this.plugin.settings.defaultTone = v;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(aiSection)
            .setName('Automatic strategy analysis')
            .setDesc(
                'Runs an extra AI call before every cover letter. Leave off for faster and more reliable local generation.'
            )
            .addToggle((t) =>
                t.setValue(this.plugin.settings.enableStrategyAnalysis).onChange(async (v) => {
                    this.plugin.settings.enableStrategyAnalysis = v;
                    await this.plugin.saveSettings();
                })
            );

        const nested = aiSection.createDiv('cla-nested-settings');

        const apiKeyComponent = (container: HTMLElement, provider: AiProvider) => {
            const secret = new SecretComponent(this.app, container);
            secret.setValue(this.plugin.getApiKeyForProvider(provider));
            secret.onChange((v) => {
                void this.plugin.setApiKeyForProvider(provider, v.trim());
            });
            return secret;
        };

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ Ollama (Local)' });

            new Setting(s)
                .setName('Ollama URL')
                .setDesc('Base URL of your local Ollama server.')
                .addText((t) =>
                    t
                        .setPlaceholder('http://localhost:11434')
                        .setValue(this.plugin.settings.ollamaUrl)
                        .onChange(async (v) => {
                            this.plugin.settings.ollamaUrl = v;
                            await this.plugin.saveSettings();
                        })
                )
                .addButton((btn) => btn.setButtonText('Refresh Models').onClick(() => this.display()));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model name, or pick from your installed models.'),
                'cla-ollama-models',
                async () => {
                    const models = await this.plugin.fetchOllamaModels();
                    return models.length > 0 ? models : ['llama3', 'mistral', 'gemma'];
                },
                this.plugin.settings.modelName,
                async (model) => {
                    this.plugin.settings.modelName = model;
                    await this.plugin.saveSettings();
                }
            );

            new Setting(s)
                .setName('Context window')
                .setDesc(
                    'Maximum Ollama context tokens for plugin requests. 8192 is safer for large local models on 24GB Macs; increase only if prompts are being truncated.'
                )
                .addText((t) =>
                    t
                        .setPlaceholder(String(DEFAULT_SETTINGS.ollamaContextWindow))
                        .setValue(String(this.plugin.settings.ollamaContextWindow))
                        .onChange(async (v) => {
                            const n = Number(v);
                            this.plugin.settings.ollamaContextWindow =
                                Number.isFinite(n) && n >= 2048 ? Math.round(n) : DEFAULT_SETTINGS.ollamaContextWindow;
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(s)
                .setName('First output timeout')
                .setDesc(
                    'Seconds to wait for the first streamed token after Ollama accepts the request. Increase this for large models or first-run model loads.'
                )
                .addText((t) =>
                    t
                        .setPlaceholder(String(DEFAULT_SETTINGS.ollamaFirstTokenTimeoutSeconds))
                        .setValue(String(this.plugin.settings.ollamaFirstTokenTimeoutSeconds))
                        .onChange(async (v) => {
                            const n = Number(v);
                            this.plugin.settings.ollamaFirstTokenTimeoutSeconds =
                                Number.isFinite(n) && n >= 30
                                    ? Math.round(n)
                                    : DEFAULT_SETTINGS.ollamaFirstTokenTimeoutSeconds;
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(s)
                .setName('Idle timeout')
                .setDesc('Seconds to wait between streamed Ollama chunks before assuming the request is stalled.')
                .addText((t) =>
                    t
                        .setPlaceholder(String(DEFAULT_SETTINGS.ollamaIdleTimeoutSeconds))
                        .setValue(String(this.plugin.settings.ollamaIdleTimeoutSeconds))
                        .onChange(async (v) => {
                            const n = Number(v);
                            this.plugin.settings.ollamaIdleTimeoutSeconds =
                                Number.isFinite(n) && n >= 30
                                    ? Math.round(n)
                                    : DEFAULT_SETTINGS.ollamaIdleTimeoutSeconds;
                            await this.plugin.saveSettings();
                        })
                );

            new Setting(s)
                .setName('Maximum request time')
                .setDesc('Minutes before a single Ollama request is aborted even if it has not failed.')
                .addText((t) =>
                    t
                        .setPlaceholder(String(DEFAULT_SETTINGS.ollamaMaxRequestMinutes))
                        .setValue(String(this.plugin.settings.ollamaMaxRequestMinutes))
                        .onChange(async (v) => {
                            const n = Number(v);
                            this.plugin.settings.ollamaMaxRequestMinutes =
                                Number.isFinite(n) && n >= 1 ? Math.round(n) : DEFAULT_SETTINGS.ollamaMaxRequestMinutes;
                            await this.plugin.saveSettings();
                        })
                );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ LM Studio (Local)' });

            new Setting(s)
                .setName('LM Studio URL')
                .setDesc('Base URL of your LM Studio local server.')
                .addText((t) =>
                    t
                        .setPlaceholder('http://localhost:1234')
                        .setValue(this.plugin.settings.lmStudioUrl)
                        .onChange(async (v) => {
                            this.plugin.settings.lmStudioUrl = v;
                            await this.plugin.saveSettings();
                        })
                )
                .addButton((btn) => btn.setButtonText('Refresh Models').onClick(() => this.display()));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick from your loaded models.'),
                'cla-lmstudio-models',
                async () => await this.plugin.fetchLmStudioModels(),
                this.plugin.settings.lmStudioModel,
                async (model) => {
                    this.plugin.settings.lmStudioModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ Anthropic Claude' });

            new Setting(s)
                .setName('API Key')
                .setDesc('Stored in Obsidian Secret Storage (not in data.json).')
                .addComponent((el) => apiKeyComponent(el, 'claude'));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick a suggestion.'),
                'cla-claude-models',
                async () => PROVIDER_MODELS.claude ?? [],
                this.plugin.settings.claudeModel,
                async (model) => {
                    this.plugin.settings.claudeModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ Google Gemini' });

            new Setting(s)
                .setName('API Key')
                .setDesc('Stored in Obsidian Secret Storage (not in data.json).')
                .addComponent((el) => apiKeyComponent(el, 'gemini'));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick a suggestion.'),
                'cla-gemini-models',
                async () => PROVIDER_MODELS.gemini ?? [],
                this.plugin.settings.geminiModel,
                async (model) => {
                    this.plugin.settings.geminiModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ OpenAI GPT' });

            new Setting(s)
                .setName('API Key')
                .setDesc('Stored in Obsidian Secret Storage (not in data.json).')
                .addComponent((el) => apiKeyComponent(el, 'openai'));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick a suggestion.'),
                'cla-openai-models',
                async () => PROVIDER_MODELS.openai ?? [],
                this.plugin.settings.openaiModel,
                async (model) => {
                    this.plugin.settings.openaiModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ Groq' });

            new Setting(s)
                .setName('API Key')
                .setDesc('Stored in Obsidian Secret Storage (not in data.json).')
                .addComponent((el) => apiKeyComponent(el, 'groq'));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick a suggestion.'),
                'cla-groq-models',
                async () => PROVIDER_MODELS.groq ?? [],
                this.plugin.settings.groqModel,
                async (model) => {
                    this.plugin.settings.groqModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        {
            const s = nested.createEl('details', { cls: 'cla-settings-section' });
            s.open = true;
            s.createEl('summary', { text: '◈ OpenRouter' });

            new Setting(s)
                .setName('API Key')
                .setDesc('Stored in Obsidian Secret Storage (not in data.json).')
                .addComponent((el) => apiKeyComponent(el, 'openrouter'));

            this.buildModelCombo(
                new Setting(s).setName('Model').setDesc('Type any model ID, or pick a suggestion.'),
                'cla-openrouter-models',
                async () => PROVIDER_MODELS.openrouter ?? [],
                this.plugin.settings.openRouterModel,
                async (model) => {
                    this.plugin.settings.openRouterModel = model;
                    await this.plugin.saveSettings();
                }
            );
        }

        // ── DESIGN & FOLDERS ─────────────────────────────────────────────
        const design = containerEl.createEl('details', { cls: 'cla-settings-section' });
        design.open = true;
        const designSummary = design.createEl('summary');
        setIcon(designSummary, 'palette');
        designSummary.createSpan({ text: ' Design & Folders' });

        new Setting(design)
            .setName('Font Family')
            .setDesc('Must be installed on your system (PDF) or available to docx viewers.')
            .addText((t) =>
                t
                    .setPlaceholder('Lora')
                    .setValue(this.plugin.settings.fontName)
                    .onChange(async (v) => {
                        this.plugin.settings.fontName = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(design)
            .setName('Page Margin (twips)')
            .setDesc('1440 twips = 1 inch. Range: 720 (½ in) – 2880 (2 in).')
            .addSlider((sl) =>
                sl
                    .setLimits(720, 2880, 120)
                    .setValue(this.plugin.settings.marginSize)
                    .setDynamicTooltip()
                    .onChange(async (v) => {
                        this.plugin.settings.marginSize = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(design)
            .setName('Signature Image')
            .setDesc('Optional: Path to a PNG of your handwritten signature (transparent background recommended).')
            .addText((t) => {
                new FileSuggest(this.app, t.inputEl);
                t.setPlaceholder('Assets/signature.png')
                    .setValue(this.plugin.settings.signaturePath)
                    .onChange(async (v) => {
                        this.plugin.settings.signaturePath = v;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(design)
            .setName('Signature Height')
            .setDesc('Adjust the size of your signature in the PDF (in pixels). Default: 85.')
            .addSlider((sl) =>
                sl
                    .setLimits(30, 200, 5)
                    .setValue(this.plugin.settings.signatureHeight)
                    .setDynamicTooltip()
                    .onChange(async (v) => {
                        this.plugin.settings.signatureHeight = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(design)
            .setName('Output Folder')
            .setDesc('Vault path where generated files are saved.')
            .addText((t) => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Cover Letters')
                    .setValue(this.plugin.settings.outputFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.outputFolder = v;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(design)
            .setName('Interview Prep Folder')
            .setDesc('Vault path where interview playbooks are saved.')
            .addText((t) => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Interviews')
                    .setValue(this.plugin.settings.interviewFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.interviewFolder = v;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(design)
            .setName('Jobs Folder')
            .setDesc('Vault path where imported job notes are saved.')
            .addText((t) => {
                new FolderSuggest(this.app, t.inputEl);
                t.setPlaceholder('Jobs')
                    .setValue(this.plugin.settings.jobsFolder)
                    .onChange(async (v) => {
                        this.plugin.settings.jobsFolder = v;
                        await this.plugin.saveSettings();
                    });
            });

        // ── JOB DASHBOARD ────────────────────────────────────────────────
        const jobDash = containerEl.createEl('details', { cls: 'cla-settings-section' });
        jobDash.open = false;
        const jobDashSummary = jobDash.createEl('summary');
        setIcon(jobDashSummary, 'rss');
        jobDashSummary.createSpan({ text: ' Job Dashboard' });

        new Setting(jobDash)
            .setName('Auto Refresh')
            .setDesc('Periodically refresh the Job Dashboard while Obsidian is open.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.jobDashboardAutoRefresh).onChange(async (v) => {
                    this.plugin.settings.jobDashboardAutoRefresh = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(jobDash)
            .setName('Refresh Interval (minutes)')
            .setDesc('Recommended: 60–240. Changes apply after reloading the plugin.')
            .addSlider((sl) =>
                sl
                    .setLimits(15, 720, 15)
                    .setValue(this.plugin.settings.jobDashboardRefreshIntervalMinutes || 180)
                    .setDynamicTooltip()
                    .onChange(async (v) => {
                        this.plugin.settings.jobDashboardRefreshIntervalMinutes = v;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(jobDash)
            .setName('Refresh on Startup')
            .setDesc('If enabled, a background refresh runs shortly after Obsidian loads.')
            .addToggle((t) =>
                t.setValue(this.plugin.settings.jobDashboardRefreshOnStartup).onChange(async (v) => {
                    this.plugin.settings.jobDashboardRefreshOnStartup = v;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(jobDash)
            .setName('Open Dashboard')
            .setDesc('Opens the Job Dashboard modal.')
            .addButton((btn) => btn.setButtonText('Open').onClick(() => this.plugin.openJobDashboard()));

        new Setting(jobDash)
            .setName('Refresh Now')
            .setDesc('Refreshes the job listings cache (you can also refresh from inside the modal).')
            .addButton((btn) =>
                btn.setButtonText('Refresh').onClick(() => {
                    void this.plugin.refreshJerseyJobOffers({ notify: 'always' });
                })
            );

        // ── CV LIBRARY ───────────────────────────────────────────────────
        const cv = containerEl.createEl('details', { cls: 'cla-settings-section' });
        cv.open = true;
        const cvSummary = cv.createEl('summary');
        setIcon(cvSummary, 'folder-heart');
        cvSummary.createSpan({ text: ' CV Library' });

        new Setting(cv)
            .setName('Add CV to Library')
            .setDesc('Add a new CV version to your collection.')
            .addButton((btn) =>
                btn.setButtonText('+ Add CV').onClick(async () => {
                    this.plugin.settings.cvPaths.push({ name: 'New CV', path: '' });
                    await this.plugin.saveSettings();
                    this.display();
                })
            );

        this.plugin.settings.cvPaths.forEach((cvItem, index) => {
            new Setting(cv)
                .addText((t) =>
                    t
                        .setPlaceholder('Label (e.g. Developer CV)')
                        .setValue(cvItem.name)
                        .onChange(async (v) => {
                            this.plugin.settings.cvPaths[index].name = v;
                            await this.plugin.saveSettings();
                        })
                )
                .addText((t) => {
                    new FileSuggest(this.app, t.inputEl);
                    t.setPlaceholder('Path/to/CV.pdf')
                        .setValue(cvItem.path)
                        .onChange(async (v) => {
                            this.plugin.settings.cvPaths[index].path = v;
                            await this.plugin.saveSettings();
                        });
                })
                .addExtraButton((btn) =>
                    btn
                        .setIcon('trash')
                        .setTooltip('Remove CV')
                        .onClick(async () => {
                            this.plugin.settings.cvPaths.splice(index, 1);
                            await this.plugin.saveSettings();
                            this.display();
                        })
                )
                .infoEl.remove();
        });

        // ── LANGUAGE ─────────────────────────────────────────────────────
        const lang = containerEl.createEl('details', { cls: 'cla-settings-section' });
        lang.open = true;
        const langSummary = lang.createEl('summary');
        setIcon(langSummary, 'languages');
        langSummary.createSpan({ text: ' Language' });

        new Setting(lang)
            .setName('Output Language')
            .setDesc('The language the AI will use to write the cover letter and email.')
            .addDropdown((dd) => {
                dd.addOption('en-GB', 'British English');
                dd.addOption('es', 'Spanish');
                dd.addOption('en-US', 'American English');
                dd.setValue(this.plugin.settings.language);
                dd.onChange(async (v) => {
                    this.plugin.settings.language = v;
                    await this.plugin.saveSettings();
                });
            });

        // ── ADVANCED CUSTOMISATION ───────────────────────────────────────
        const adv = containerEl.createEl('details', { cls: 'cla-settings-section' });
        adv.open = false;
        const advSummary = adv.createEl('summary');
        setIcon(advSummary, 'settings-2');
        advSummary.createSpan({ text: ' AI Customisation (Advanced)' });

        new Setting(adv)
            .setName('Custom Banned Words')
            .setDesc('Comma-separated list of words/phrases the AI is forbidden to use.')
            .addTextArea((t) =>
                t.setValue(this.plugin.settings.customBannedWords.join(', ')).onChange(async (v) => {
                    this.plugin.settings.customBannedWords = v
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                    await this.plugin.saveSettings();
                })
            );

        adv.querySelectorAll('textarea').forEach((t) => {
            (t as HTMLTextAreaElement).style.width = '100%';
            (t as HTMLTextAreaElement).style.resize = 'vertical';
            (t as HTMLTextAreaElement).rows = 4;
        });

        const promptSetting = new Setting(adv)
            .setName('Base Prompt')
            .setDesc(
                'Modify the core AI instructions. Use {profile}, {strategy}, {jobContent}, {language}, and {bannedWords}.'
            )
            .addTextArea((t) => {
                t.inputEl.rows = 30;
                t.inputEl.style.width = '100%';
                t.inputEl.style.resize = 'vertical';
                t.inputEl.style.fontFamily = 'monospace';
                t.setValue(this.plugin.settings.customPrompt).onChange(async (v) => {
                    this.plugin.settings.customPrompt = v;
                    await this.plugin.saveSettings();
                });
            });
        promptSetting.settingEl.style.flexDirection = 'column';
        promptSetting.settingEl.style.alignItems = 'flex-start';
        promptSetting.controlEl.style.width = '100%';
        promptSetting.controlEl.style.marginTop = '10px';
    }
}

class FolderSuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        private inputEl: HTMLInputElement
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): string[] {
        const files = this.app.vault.getAllLoadedFiles();
        const out: string[] = [];
        const q = query.toLowerCase();
        files.forEach((f) => {
            if (f instanceof TFolder && f.path.toLowerCase().includes(q)) out.push(f.path);
        });
        return out;
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value);
    }

    selectSuggestion(value: string) {
        this.inputEl.value = value;
        this.inputEl.dispatchEvent(new Event('input'));
        this.inputEl.dispatchEvent(new Event('change'));
        this.close();
    }
}

class FileSuggest extends AbstractInputSuggest<string> {
    constructor(
        app: App,
        private inputEl: HTMLInputElement
    ) {
        super(app, inputEl);
    }

    getSuggestions(query: string): string[] {
        const files = this.app.vault.getAllLoadedFiles();
        const out: string[] = [];
        const q = query.toLowerCase();
        files.forEach((f) => {
            if (f instanceof TFile && f.path.toLowerCase().includes(q)) out.push(f.path);
        });
        return out;
    }

    renderSuggestion(value: string, el: HTMLElement) {
        el.setText(value);
    }

    selectSuggestion(value: string) {
        this.inputEl.value = value;
        this.inputEl.dispatchEvent(new Event('input'));
        this.inputEl.dispatchEvent(new Event('change'));
        this.close();
    }
}
