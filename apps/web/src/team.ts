// Who builds Walk We, shown in the "Made by" section on the welcome page.
// Same team as DeePer (photos copied from DeePer's assets, resized to 192 px).
// A '\n' in a role starts a new line.
import nathapornPhoto from './assets/team/nathaporn.webp';
import natshaPhoto from './assets/team/natsha.webp';
import siriphanaphornPhoto from './assets/team/siriphanaphorn.webp';

export interface TeamMember {
  nameTh: string;
  nameEn: string;
  roleTh: string;
  roleEn: string;
  avatar: string;
}

export const TEAM: TeamMember[] = [
  {
    nameTh: 'ณฐพร ไทรทับทิม',
    nameEn: 'Nathaporn Saituptim',
    roleTh: 'AI Engineer / Developer',
    roleEn: 'AI Engineer / Developer',
    avatar: nathapornPhoto,
  },
  {
    nameTh: 'นัชชา ตติยชัยทวีสุข',
    nameEn: 'Natsha Tatiyachaitaweesuk',
    roleTh: 'Support / Marketing',
    roleEn: 'Support / Marketing',
    avatar: natshaPhoto,
  },
  {
    nameTh: 'ศริพนาพร ศิริกุล',
    nameEn: 'Siriphanaphorn Sirikun',
    roleTh: 'Developer',
    roleEn: 'Developer',
    avatar: siriphanaphornPhoto,
  },
];
