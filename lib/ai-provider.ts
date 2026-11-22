/**
 * AI provider abstraction.
 *
 * Business logic depends only on `AIProvider`, never on a specific vendor.
 * Additional providers (organization-approved endpoint, private/self-hosted
 * model, Azure OpenAI, etc.) implement the same interface and are selected by
 * organization settings, so no application code changes when a tenant moves
 * its AI processing elsewhere.
 */

export interface GenerateRequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface GenerateResult {
  text: string;
  provider: string;
  model: string;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

export interface ProviderConfig {
  provider?: string | undefined;
  model?: string | undefined;
  baseUrl?: string | undefined;
  apiKey: string;
}

class GatewayProvider implements AIProvider {
  readonly name: string;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ProviderConfig) {
    this.name = config.provider ?? "lovable-ai-gateway";
    this.model = config.model ?? "google/gemini-3.7-flash";
    this.baseUrl = config.baseUrl ?? "https://ai.gateway.lovable.dev/v1";
    this.apiKey = config.apiKey;
  }

  async generate({ systemPrompt, userPrompt }: GenerateRequest): Promise<GenerateResult> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": this.apiKey,
      },
      body: JSON.stringify({
        model: this.model,
        // Case notes are rewrites of the worker's own account; long hidden
        // reasoning roughly doubled response time without improving notes.
        reasoning_effort: "low",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new AIProviderError(
        response.status === 429
          ? "The AI service is busy right now. Please try again in a moment."
          : response.status === 402
            ? "This organization's AI credits are exhausted. Please contact your administrator."
            : `AI request failed (${response.status}). ${body.slice(0, 200)}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AIProviderError("The AI service returned an empty response.", 502);
    return { text, provider: this.name, model: this.model };
  }
}

/** Resolves the provider for an organization. Only the gateway ships today. */
export function resolveProvider(config: ProviderConfig): AIProvider {
  return new GatewayProvider(config);
}
