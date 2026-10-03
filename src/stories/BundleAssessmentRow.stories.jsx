import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import BundleAssessmentRow from '../components/BundleAssessmentRow';
import { Notice } from '../components/UI';

function InteractiveRow(args) {
  const [checked, setChecked] = useState(args.checked);
  const [removed, setRemoved] = useState(false);
  return <div className="ds-story" style={{maxWidth:720}}>
    {removed ? <p role="status">Assessment removed.</p> : <BundleAssessmentRow {...args} checked={checked}
      onCheckedChange={setChecked} onRemove={args.removable ? ()=>setRemoved(true) : undefined}/>}
  </div>;
}

export default {
  title: '04 Records/Bundle assessment row',
  component: BundleAssessmentRow,
  tags: ['autodocs'],
  render: InteractiveRow,
  args: {name:'WHO-5 Well-Being Index',checkboxLabel:'Mandatory',checked:true,disabled:false,removable:true},
  argTypes: {
    onCheckedChange: {table:{disable:true}}, onRemove: {table:{disable:true}},
    secondary: {table:{disable:true}}, removable: {control:'boolean'},
  },
  parameters: {docs:{description:{component:'Shared compact assessment row for Administration and person bundle editors. Template checkboxes edit Mandatory; person checkboxes select optional assessments while mandatory assessments remain locked. Removal uses the right-hand delete icon with a divider.'}}},
};

export const Administration = {
  play: async ({canvasElement})=>{
    const canvas=within(canvasElement);
    const checkbox=canvas.getByRole('checkbox',{name:'Mandatory: WHO-5 Well-Being Index'});
    await expect(checkbox).toBeChecked();
    await userEvent.click(checkbox);
    await expect(checkbox).not.toBeChecked();
    await userEvent.click(canvas.getByRole('button',{name:'Remove WHO-5 Well-Being Index'}));
    await expect(canvas.getByRole('heading',{name:'Remove WHO-5 Well-Being Index?'})).toBeVisible();
    await userEvent.click(within(canvas.getByRole('dialog',{name:'Remove WHO-5 Well-Being Index?'})).getByRole('button',{name:'Cancel'}));
    await expect(canvas.getByRole('button',{name:'Remove WHO-5 Well-Being Index'})).toBeVisible();
    await userEvent.click(canvas.getByRole('button',{name:'Remove WHO-5 Well-Being Index'}));
    await userEvent.click(canvas.getByRole('button',{name:'Remove measure'}));
    await expect(canvas.getByRole('status')).toHaveTextContent('Assessment removed.');
  },
};
export const LockedMandatory = {args:{name:'90-day review',removable:false,disabled:true}};
export const OptionalSelection = {
  args:{checkboxLabel:'Optional',checked:false,removable:false},
  play: async ({canvasElement})=>{
    const checkbox=within(canvasElement).getByRole('checkbox',{name:'Optional: WHO-5 Well-Being Index'});
    await userEvent.click(checkbox);
    await expect(checkbox).toBeChecked();
  },
};
export const AdditionalAssessment = {args:{name:'Learning and work',checkboxLabel:'',status:'Added'}};
export const Unavailable = {args:{disabled:true,removable:false,secondary:<Notice tone="amber">SMS collection is unavailable. Choose an available bundle collection method.</Notice>}};
export const Narrow = {
  args:{name:'Strengths and Difficulties Questionnaire (SDQ)'},
  decorators:[Story=><div style={{maxWidth:340}}><Story/></div>],
};
