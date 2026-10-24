import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ExternalLink, Key, Shield, Smartphone, BookOpen, CheckCircle, Copy } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const tokenSchema = z.object({
  token: z.string().trim().min(10, "Token must be at least 10 characters long"),
});

export function TokenForm({ onSave }: { onSave: (token: string) => void | Promise<unknown> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScopesOpen, setIsScopesOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [clientId, setClientId] = useState("");
  const form = useForm<z.infer<typeof tokenSchema>>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { token: "" },
  });

  const trimmedClientId = clientId.trim();
  const authUrl = trimmedClientId
    ? `https://oauth.yandex.ru/authorize?response_type=token&client_id=${encodeURIComponent(trimmedClientId)}`
    : "";

  async function onSubmit(values: z.infer<typeof tokenSchema>) {
    setIsSaving(true);
    try {
      await onSave(values.token);
      toast({
        title: "Токен сохранён",
        description: "Он хранится на сервере в зашифрованном виде.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Не удалось сохранить токен",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function openAuthUrl() {
    if (authUrl) window.open(authUrl, "_blank", "noopener,noreferrer");
  }

  async function copyAuthUrl() {
    if (!authUrl) return;
    try {
      await navigator.clipboard.writeText(authUrl);
      toast({ title: "Ссылка скопирована" });
    } catch {
      toast({ variant: "destructive", title: "Не удалось скопировать ссылку" });
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="w-full max-w-md border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl text-primary">Авторизация</CardTitle>
          <CardDescription>
            Введите Yandex OAuth токен для подключения к API умного дома.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="token"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Токен доступа</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="AQAAA..."
                        type="password"
                        className="font-mono"
                        data-testid="input-yandex-token"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={isSaving}
                data-testid="button-save-token"
              >
                {isSaving ? "Проверка..." : "Подключить"}
              </Button>
            </form>
          </Form>

          {/* Instructions section */}
          <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
              >
                <Key className="w-4 h-4" />
                <span>Как получить токен доступа?</span>
                <ChevronDown
                  className={`w-4 h-4 ml-auto transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4 text-sm text-muted-foreground">
              <div className="space-y-3">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Перейдите на страницу OAuth Яндекса</p>
                    <a
                      href="https://oauth.yandex.ru/client/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                    >
                      oauth.yandex.ru/client/new
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Создайте новое приложение</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      <li className="flex items-center gap-2">
                        <Shield className="w-3 h-3" />
                        <span>Платформа: <strong>Веб-сервисы</strong></span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Smartphone className="w-3 h-3" />
                        <span>Redirect URI: <code className="bg-muted px-1 rounded">https://localhost</code></span>
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Получите Client ID</p>
                    <p className="mt-1 text-xs">
                      После создания на странице приложения появится <strong>Client ID</strong>. Скопируйте его.
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    4
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Откройте URL авторизации</p>
                    <p className="mt-1 text-xs">Вставьте ваш Client ID — ссылка соберётся автоматически:</p>
                    <Input
                      placeholder="Client ID"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="font-mono text-xs mt-2"
                      data-testid="input-oauth-client-id"
                    />
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={openAuthUrl}
                        disabled={!authUrl}
                        data-testid="button-open-oauth-url"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Открыть ссылку
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={copyAuthUrl}
                        disabled={!authUrl}
                        aria-label="Скопировать ссылку"
                        data-testid="button-copy-oauth-url"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {authUrl && (
                      <code className="block mt-2 p-2 bg-muted rounded text-xs break-all">
                        {authUrl}
                      </code>
                    )}
                  </div>
                </div>

                {/* Step 5 */}
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    5
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Скопируйте токен из URL</p>
                    <p className="mt-1 text-xs">
                      После авторизации вас перенаправит. Скопируйте значение <code className="bg-muted px-1 rounded">access_token</code> из адресной строки.
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Важно</p>
                <ul className="mt-1 space-y-1 text-yellow-600/80 dark:text-yellow-400/80">
                  <li>• Токен проверяется Яндексом и хранится на сервере в зашифрованном виде</li>
                  <li>• В браузере токен не сохраняется — только HttpOnly cookie сессии панели</li>
                  <li>• Никогда не передавайте токен другим лицам</li>
                  <li>• Токен может истечь — обновите при проблемах с подключением</li>
                </ul>
              </div>

              {/* OAuth Scopes Reference */}
              <Collapsible open={isScopesOpen} onOpenChange={setIsScopesOpen} className="mt-3">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Справочник прав доступа (OAuth scopes)</span>
                    <ChevronDown
                      className={`w-4 h-4 ml-auto transition-transform ${isScopesOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-3 text-xs text-muted-foreground">
                  <p>При создании OAuth-приложения на <a href="https://oauth.yandex.ru/client/new" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">oauth.yandex.ru</a> выберите нужные права доступа:</p>

                  {/* Smart Home scopes */}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 font-medium text-foreground flex items-center gap-2">
                      <span>🏠</span> Умный дом
                    </div>
                    <div className="divide-y divide-border/30">
                      <ScopeRow
                        scope="iot:read"
                        description="Просмотр устройств, комнат, сценариев и их состояний"
                        required={true}
                      />
                      <ScopeRow
                        scope="iot:control"
                        description="Управление устройствами и запуск сценариев"
                        required={true}
                      />
                    </div>
                  </div>

                  {/* Media scopes */}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 font-medium text-foreground flex items-center gap-2">
                      <span>🔊</span> Колонки и медиа
                    </div>
                    <div className="divide-y divide-border/30">
                      <ScopeRow
                        scope="iot:quasar"
                        description="Управление Яндекс.Станциями и колонками"
                        required={false}
                      />
                      <ScopeRow
                        scope="music"
                        description="Доступ к музыкальной библиотеке и воспроизведению"
                        required={false}
                      />
                    </div>
                  </div>

                  {/* Camera scopes */}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 font-medium text-foreground flex items-center gap-2">
                      <span>📹</span> Камеры
                    </div>
                    <div className="divide-y divide-border/30">
                      <ScopeRow
                        scope="iot:cameras"
                        description="Доступ к видео-камерам и архиву записей"
                        required={false}
                      />
                    </div>
                  </div>

                  {/* User info scopes */}
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 font-medium text-foreground flex items-center gap-2">
                      <span>👤</span> Информация пользователя
                    </div>
                    <div className="divide-y divide-border/30">
                      <ScopeRow
                        scope="login:info"
                        description="Базовая информация профиля (необязательно)"
                        required={false}
                      />
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="font-medium text-primary flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Рекомендации
                    </p>
                    <ul className="mt-2 space-y-1 text-primary/80">
                      <li>• Для базовой работы достаточно: <code className="bg-muted px-1 rounded">iot:read</code> + <code className="bg-muted px-1 rounded">iot:control</code></li>
                      <li>• <code className="bg-muted px-1 rounded">iot:read</code> — просмотр устройств и сценариев</li>
                      <li>• <code className="bg-muted px-1 rounded">iot:control</code> — управление устройствами и запуск сценариев</li>
                      <li>• <code className="bg-muted px-1 rounded">iot:quasar</code> нужен только для управления колонками</li>
                      <li>• <code className="bg-muted px-1 rounded">iot:cameras</code> нужен для доступа к видеопотокам</li>
                      <li>• При первом входе Яндекс запросит подтверждение доступа</li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </div>
  );
}

function ScopeRow({ scope, description, required }: { scope: string; description: string; required: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2">
      <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{scope}</code>
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{description}</p>
      </div>
      {required ? (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] border border-[hsl(var(--gold))]/20">
          Обязательно
        </span>
      ) : (
        <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/50">
          Опционально
        </span>
      )}
    </div>
  );
}
