import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MoreVertical, Star } from "lucide-react";

import {
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  IconButton,
  Input,
  Logo,
  Menu,
  Select,
  Spinner,
  Switch,
  Tabs,
  Textarea,
  toast,
} from "../components/ui";

/**
 * Dev-only component gallery.
 *
 * Renders every primitive in the current language and theme so EN/AR + light/dark
 * can be reviewed side by side. Reachable at `#gallery` in development builds.
 */
export function GalleryView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState("buttons");
  const [checked, setChecked] = useState(true);
  const [switchOn, setSwitchOn] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-10 p-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={32} withWordmark />
        </div>
        <Badge tone="emerald">design system</Badge>
      </header>

      <Section title="Brand">
        <div className="flex items-end gap-8">
          <Logo size={64} />
          <Logo size={32} />
          <Logo size={16} />
          <div className="flex h-16 w-16 items-center justify-center rounded-tile bg-tile">
            <Logo size={36} />
          </div>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large (44px)</Button>
          <Button disabled>Disabled</Button>
          <Button icon={<Star className="h-4 w-4" />}>With icon</Button>
        </div>
        <div className="flex items-center gap-3">
          <IconButton label="More">
            <MoreVertical className="h-4 w-4" />
          </IconButton>
          <IconButton label="Star" active>
            <Star className="h-4 w-4" />
          </IconButton>
          <Spinner />
        </div>
      </Section>

      <Section title="Inputs">
        <div className="grid max-w-md gap-4">
          <Input label="Label" placeholder="Placeholder" />
          <Input
            label="With hint"
            placeholder="Value"
            hint="Helpful hint text"
          />
          <Input
            label="With error"
            placeholder="Value"
            error="This field is required"
          />
          <Select label="Select">
            <option>{t("type.login")}</option>
            <option>{t("type.note")}</option>
            <option>{t("type.card")}</option>
          </Select>
          <Textarea label="Textarea" rows={2} placeholder="…" />
          <div className="flex items-center gap-6">
            <Checkbox
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            >
              Checkbox
            </Checkbox>
            <Switch checked={switchOn} onChange={setSwitchOn} label="Switch" />
          </div>
        </div>
      </Section>

      <Section title="Surfaces">
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <p className="text-sm font-medium">Plain card</p>
            <p className="text-xs text-muted">1px quiet border</p>
          </Card>
          <Card tone="raised" className="p-4">
            <p className="text-sm font-medium">Raised card</p>
            <p className="text-xs text-muted">soft shadow</p>
          </Card>
          <Card tone="sunken" className="p-4">
            <p className="text-sm font-medium">Sunken card</p>
            <p className="text-xs text-muted">inset surface</p>
          </Card>
        </div>
        <div className="flex gap-2">
          <Badge>neutral</Badge>
          <Badge tone="emerald">emerald</Badge>
          <Badge tone="amber">amber</Badge>
          <Badge tone="mint">mint</Badge>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-3">
          <Avatar name="Northstar" />
          <Avatar name="Atlas Workspace" />
          <Avatar name="Luma Studio" />
          <Avatar name="Streamly" />
          <Avatar name="Horizon Stays" />
          <Avatar name="DevHub" />
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex items-center gap-3">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Menu
            label="Actions"
            trigger={<MoreVertical className="h-5 w-5" />}
            items={[
              {
                id: "edit",
                label: t("actions.edit"),
                onSelect: () => undefined,
              },
              {
                id: "fav",
                label: t("actions.favorite"),
                onSelect: () => undefined,
              },
              {
                id: "del",
                label: t("actions.delete"),
                danger: true,
                onSelect: () => undefined,
              },
            ]}
          />
          <Button
            variant="secondary"
            onClick={() =>
              toast(t("common.copiedClearing", { seconds: 30 }), "emerald")
            }
          >
            Show toast
          </Button>
        </div>
        <Tabs
          items={[
            { id: "buttons", label: "Buttons" },
            { id: "forms", label: "Forms" },
            { id: "cards", label: "Cards" },
          ]}
          value={tab}
          onChange={setTab}
        />
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Dialog title"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button onClick={() => setDialogOpen(false)}>
                {t("actions.save")}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted">Modal content. Escape closes it.</p>
        </Dialog>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="border-b border-mist pb-2 text-xs uppercase tracking-wide text-muted dark:border-navy">
        {title}
      </h2>
      {children}
    </section>
  );
}
