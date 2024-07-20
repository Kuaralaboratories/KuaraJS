import '@Kuarajs';

export default function ({ button }) {
    function button(push) {
        const push = console.info("you pushed me!");
    }

    return () => {
        return html`
        <a href='#'>push me!</a>`;
    };
}