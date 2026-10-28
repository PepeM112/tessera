import { memo, type ComponentType } from "react";

import { useWorkspaceContext } from "./workspace-context";

import type { ModuleProps } from "./layout";

interface ModuleContentProps {
  moduleId: string;
  props: ModuleProps | undefined;
}

interface ModuleViewProps {
  component: ComponentType<never>;
  props: ModuleProps | undefined;
}

/** The module with the id `moduleId`, or the unknown tile when it is not in `modules`. */
export function ModuleContent({ moduleId, props }: ModuleContentProps) {
  const { modules, renderUnknown } = useWorkspaceContext();
  // hasOwn: a module id like "toString" must not find a method of Object.prototype.
  const component = Object.hasOwn(modules, moduleId) ? modules[moduleId] : undefined;
  return component ? <ModuleView component={component} props={props} /> : renderUnknown(moduleId);
}

// Memoized on the component and the props object, so a resize does not render the module again.
const ModuleView = memo(function ModuleView({ component, props }: ModuleViewProps) {
  // SAFETY: a layout's props are the module's props by contract. defineLayout checks them in TS layouts.
  const Module = component as ComponentType<ModuleProps>;
  return <Module {...props} />;
});
