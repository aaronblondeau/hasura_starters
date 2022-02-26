using Microsoft.AspNetCore.Mvc;

namespace HasuraStarter.Controllers;

[ApiController]
[Route("hasura/actions/whoami")]
public class ActionWhoamiController : ControllerBase
{
    private readonly ILogger<ActionWhoamiController> _logger;

    public ActionWhoamiController(ILogger<ActionWhoamiController> logger)
    {
        _logger = logger;
    }

    [HttpPost(Name = "ActionWhoami")]
    public WhoamiResponse Post()
    {
        return new WhoamiResponse(1.ToString());
    }
}
