import { DEFAULT_MEMBER_IMAGE, getMemberImage, getTeamMemberByName } from './team';

describe('getMemberImage', () => {
    it("returns the member's own picture, whatever the casing of the name", () => {
        expect(getMemberImage('jacob')).toBe(getTeamMemberByName('Jacob')?.image);
    });

    it('falls back to the default for a name that is not a member', () => {
        expect(getMemberImage('Werner')).toBe(DEFAULT_MEMBER_IMAGE);
    });

    it('falls back to the default for a member whose image is blank', () => {
        const member = getTeamMemberByName('Dustin');
        const original = member!.image;
        member!.image = ' ';
        try {
            expect(getMemberImage('Dustin')).toBe(DEFAULT_MEMBER_IMAGE);
        } finally {
            member!.image = original;
        }
    });
});
