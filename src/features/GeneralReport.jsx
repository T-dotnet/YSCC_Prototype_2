import { Badge, PageHeading, Panel, Notice } from "../components/UI";

export default function GeneralReport() {
  return (
    <>
      <PageHeading title="General report" subtitle="Workspace reporting" meta={<Badge>WIP</Badge>} />
      <Panel title="Work in progress">
        <Notice>The general report is being developed. Reporting content will be added here.</Notice>
      </Panel>
    </>
  );
}
